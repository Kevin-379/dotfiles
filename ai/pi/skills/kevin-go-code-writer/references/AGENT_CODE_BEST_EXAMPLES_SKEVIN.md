# Agent Code Examples

## Best Examples

### Parse, don’t verify — Example 26

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/controller/fare/fare.go`

```go
// BuildTieredFareData parses a pricing plan and returns a tiered fare summary
func BuildTieredFareData(
	ctx context.Context,
	cityID int,
	plan *commonpb.PricingPlan,
	opts entity.TieredFareOpts,
) entity.TieredFareData {
	tieredFareData := entity.TieredFareData{
		Currency: plan.GetCurrency(),
	}

	unlockFeeE5 := fareToE5(plan.GetPrice())
	if unlockFeeE5 > 0 {
		tieredFareData.UnlockFeeOriginalE5 = unlockFeeE5
		tieredFareData.UnlockFeeRemainingE5 = unlockFeeE5
	}

	// Step 1: Parse tiers
	for _, tier := range plan.GetPerMinPricing() {
		rateE5 := fareToE5(tier.GetRate())

		if tier.GetInterval() == 0 { // Flat tier
			endTime := tier.GetEndTime()

			if endTime.GetValue() == 0 { // Malformed tier
				logger.FromContext(ctx).
					Warn(
						"malformed flat tier: end time is nil or zero",
						zap.Any("tier", tier),
					)
				continue
			}

			tieredFareData.FlatTiers = append(tieredFareData.FlatTiers, entity.FlatTier{
				EndMinute:          endTime.GetValue(),
				TierFeeOriginalE5:  rateE5,
				TierFeeRemainingE5: rateE5,
			})
		} else { // Per-min tier
			var endTime *int32
			if et := tier.GetEndTime(); et != nil && et.GetValue() > 0 {
				endTime = ptr.Int32(et.GetValue())
			}

			tieredFareData.PerMinTiers = append(tieredFareData.PerMinTiers, entity.PerMinTier{
				StartMinute: tier.GetStartTime(),
				EndMinute:   endTime,
				RateE5:      rateE5,
				Interval:    tier.GetInterval(),
			})
		}
	}

	var pricingPlanType = "immediate_per_min"
	if len(tieredFareData.FlatTiers) > 0 {
		pricingPlanType = "flat_tier"
	} else if len(tieredFareData.PerMinTiers) > 0 &&
		tieredFareData.PerMinTiers[0].StartMinute > 0 {
		pricingPlanType = "delayed_per_min"
	}

	metrics.FromContext(ctx).
		Tagged(map[string]string{
			"plan_type":              pricingPlanType,
			common_metrics.CityIDTag: strconv.Itoa(cityID),
		}).
		Counter("pricing_plan_type").
		Inc(1)

	// Step 2: Free unlock
	if opts.FreeUnlockActive {
		tieredFareData.UnlockFeeRemainingE5 = 0
		for i := range tieredFareData.FlatTiers {
			tieredFareData.FlatTiers[i].TierFeeRemainingE5 = 0
		}
	}

	// Step 3: Apply Uber One credits to Unlock fee and flat tiers
	remaining := opts.DiscountCreditsE5
	if remaining <= 0 {
		return tieredFareData
	}

	unlockConsumed := min(remaining, tieredFareData.UnlockFeeRemainingE5)
	remaining -= unlockConsumed
	tieredFareData.UnlockFeeRemainingE5 -= unlockConsumed

	for i := range tieredFareData.FlatTiers {
		if remaining == 0 {
			return tieredFareData // no more discounts to apply
		}

		consumed := min(remaining, tieredFareData.FlatTiers[i].TierFeeRemainingE5)
		remaining -= consumed
		tieredFareData.FlatTiers[i].TierFeeRemainingE5 -= consumed
	}

	// Step 4: Convert excess credits to free minutes
	for _, tier := range tieredFareData.PerMinTiers {
		// The maximum number of minutes we can afford for this tier based on the remaining credits
		affordableMinutes := int32(remaining/tier.RateE5) * tier.Interval

		// The maximum number of minutes in this tier for which we can use credits
		// If the tier is open-ended, the cap equals what we can afford
		// Otherwise, the cap is the duration of the tier
		maxTierMinutes := affordableMinutes // open-ended: cap equals what we can afford
		if tier.EndMinute != nil {
			maxTierMinutes = *tier.EndMinute - tier.StartMinute
		}

		// The number of free minutes added by this tier
		addedMinutes := min(affordableMinutes, maxTierMinutes)
		tieredFareData.FreeMinutes += addedMinutes
		// The amount of credits consumed by the free minutes
		remaining -= int64(addedMinutes/tier.Interval) * tier.RateE5

		// If we exhaust the credits in this tier, i.e. we cannot fully afford the tier, we are done
		if affordableMinutes <= maxTierMinutes {
			break
		}
	}

	return tieredFareData
}
```

### Formatting — Example 8

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/controller/featureplugins/navigate_flow_direct_navigation.go`

```go
func (s *directNavigationStrategy) BuildServerAction(
	ctx context.Context,
	p *navigatePresenter,
	req *PresentViewsRequest,
) *mimodataschemas.EMobilityServerAction {
	destinationMapMarkers := maputils.GetDestinationMapMarker(
		_selectedMapLayerDestinationFloatingMarkerID,
		geometry.Point{
			Latitude:  geometry.LatitudeDegrees(s.destinationDetails.GetLatitude()).Ptr(),
			Longitude: geometry.LongitudeDegrees(s.destinationDetails.GetLongitude()).Ptr(),
		},
		presentationutils.GetUserFacingDestinationName(req.Translate, s.destinationDetails.GetName()),
	)

	return &mimodataschemas.EMobilityServerAction{
		SingleAssetSelectAction: &emobility_rider_presentation_types_v2.SingleAssetSelectAction{
			ID: fmt.Sprintf(
				"%s-%s",
				navigateDestinationServerActionIDPrefix,
				ptr.GetOrZero(s.destinationDetails.Name),
			),
			Asset: &emobility_rider_presentation_types_v2.EMobilityAsset{
				Station: &emobility_rider_presentation_types_v2.EMobilityStation{
					ID: "destination",
					Location: &emobility_rider_presentation_types_v2.EMobilityGeoCoordinates{
						Latitude:  s.destinationDetails.GetLatitude(),
						Longitude: s.destinationDetails.GetLongitude(),
					},
					Presentation: &emobility_rider_presentation_types_v2.EMobilityStationPresentation{
						SelectedMapMarkerModels: destinationMapMarkers,
						SelectedMapLayerPresentation: &emobility_rider_presentation_types_v2.MicromobilityMapLayerPresentation{
							MapLayerModel: &mapmodel.MapLayerModel{
								ID:         ptr.Of(_selectedMapLayerID),
								MapMarkers: destinationMapMarkers,
							},
						},
					},
				},
			},
			IgnoreUserMapInteraction: ptr.Of(true),
		},
	}
}
```

### Top-down code structure — Example 13

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/controller/featureplugins/navigate.go`

```go
func (p *navigatePresenter) PresentViews(ctx context.Context, req *PresentViewsRequest) (*mimodataschemas.ViewsHolder, error) {
	navigationFeatureState, err := getNavigationFeatureStateFromBooking(req.Booking)
	if err != nil {
		return nil, err
	}
	strategy, err := p.getNavigationStrategy(ctx, navigationFeatureState, req)
	if err != nil {
		return nil, err
	}
	return p.presentViewsWithStrategy(ctx, req, strategy), nil
}

func (p *navigatePresenter) getNavigationStrategy(
	ctx context.Context,
	navigationFeatureState *plugins.NavigateFeatureState,
	req *PresentViewsRequest,
) (navigationStrategy, error) {
	if navigationFeatureState.DestinationDetails != nil {
		if !utils.IsPointerStringEmpty(navigationFeatureState.SelectedStationUUID) {
			return newNavigationViaStationStrategy(
				ctx,
				p,
				req,
				*navigationFeatureState.SelectedStationUUID,
				*navigationFeatureState.DestinationDetails,
			)
		}
		if navigationFeatureState.ParkingCoordinates != nil {
			return newDirectNavigationToRestrictedAreaStrategy(
				ctx,
				p,
				req,
				*navigationFeatureState.DestinationDetails,
				*navigationFeatureState.ParkingCoordinates,
			), nil
		}
		return newDirectNavigationStrategy(
			ctx,
			p,
			req,
			*navigationFeatureState.DestinationDetails,
		), nil
	}
	if !utils.IsPointerStringEmpty(navigationFeatureState.SelectedStationUUID) {
		return newSelectedStationOnlyStrategy(
			ctx,
			p,
			req,
			*navigationFeatureState.SelectedStationUUID,
		)
	}
	return nil, errors.New("No active navigation")
}
```

### Unit test design — Example 27

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/controller/fare/fare_test.go`

```go
func TestBuildTieredFareData(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name                string
		plan                *commonpb.PricingPlan
		opts                entity.TieredFareOpts
		want                entity.TieredFareData
		wantPricingPlanType string
	}{
		{
			name: "should_return_unlock_fee_and_2_per_min_tier_when_immediate_per_min_with_2_per_min_tiers",
			plan: &commonpb.PricingPlan{
				Currency: "USD",
				Price:    1,
				PerMinPricing: []*commonpb.PerUnitPricing{
					perMinUsd25Till4,
					perMinUsd25After4,
				},
			},
			want: entity.TieredFareData{
				Currency:             "USD",
				UnlockFeeOriginalE5:  100000,
				UnlockFeeRemainingE5: 100000,
				PerMinTiers: []entity.PerMinTier{
					{
						StartMinute: 0,
						EndMinute:   ptr.Int32(4),
						RateE5:      25000,
						Interval:    1,
					},
					{
						StartMinute: 4,
						RateE5:      50000,
						Interval:    1,
					},
				},
			},
			wantPricingPlanType: "immediate_per_min",
		},
		{
			name: "should_return_unlock_fee_and_delayed_per_min_when_delayed_per_min",
			plan: delayedPerMinPlan,
			want: entity.TieredFareData{
				Currency:             "BRL",
				UnlockFeeOriginalE5:  500000,
				UnlockFeeRemainingE5: 500000,
				PerMinTiers: []entity.PerMinTier{
					{
						StartMinute: 15,
						RateE5:      100000,
						Interval:    1,
					},
				},
			},
			wantPricingPlanType: "delayed_per_min",
		},
		{
			name: "should_zero_unlock_when_immediate_per_min_free_unlock",
			plan: immediatePerMinPlan,
			opts: entity.TieredFareOpts{
				FreeUnlockActive: true,
			},
			want: entity.TieredFareData{
				Currency:             "USD",
				UnlockFeeOriginalE5:  100000,
				UnlockFeeRemainingE5: 0,
				PerMinTiers: []entity.PerMinTier{
					{
						StartMinute: 0,
						RateE5:      25000,
						Interval:    1,
					},
				},
			},
			wantPricingPlanType: "immediate_per_min",
		},
		{
			name: "should_convert_credits_to_free_min_when_immediate_per_min_2_usd_credits",
			plan: immediatePerMinPlan,
			opts: entity.TieredFareOpts{
				DiscountCreditsE5: 200000,
			},
			want: entity.TieredFareData{
				Currency:             "USD",
				UnlockFeeOriginalE5:  100000,
				UnlockFeeRemainingE5: 0,
				PerMinTiers: []entity.PerMinTier{
					{
						StartMinute: 0,
						RateE5:      25000,
						Interval:    1,
					},
				},
				FreeMinutes: 4,
			},
			wantPricingPlanType: "immediate_per_min",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := BuildTieredFareData(context.Background(), 1, tt.plan, tt.opts)
			assert.Equal(t, tt.want, got)
		})
	}
}
```

### Mocks — Example 20

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/controller/destination_refinement/destination_refinement_test.go`

```go
func (tc *testClient) addSearchZonesRequestResponse(
	request entity.RiderSearchZonesRequest,
	response entity.RiderSearchZonesResponse,
) {
	tc.riderMapSearchV2Mock.Let().
		SearchZones().
		With(tc.Ctx, request).
		Return(&response, nil).
		Times(1)
}

func (tc *testClient) addPredictBulkRequestResponse(
	request commonEntity.PredictBulkRequest,
	response commonEntity.PredictBulkResponse,
) {
	tc.uetaMock.Let().
		PredictBulk().
		With(tc.Ctx, &request).
		Return(&response, nil).
		Times(1)
}

func (tc *testClient) addSearchAssetsRequestResponse(
	request entity.RiderSearchAssetsRequest,
	response entity.RiderSearchAssetsResponse,
) {
	tc.riderMapSearchV2Mock.Let().
		SearchAssets().
		With(tc.Ctx, request).
		Return(&response, nil).
		Times(1)
}
```

### Feature flags — Example 21

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/controller/destination_refinement/destination_refinement_presenter_test.go`

```go
t.Run("no_refinement", func(t *testing.T) {
	tc := setupPresenterTestClient(t)
	tc.localizationCtrlMock.Let().GetTranslator().Return(func(key, defaultVal string, values map[string]string) string {
		return defaultVal
	}, nil)
	tc.fliprControllerMock.Let().GetImageURL().Return(imageURLs, nil).Times(1)
	tc.fliprControllerMock.Let().
		GetBreezeM2Configuration().
		Return(entity.BreezeM2Configuration{}, nil).Times(1)

	request := entity.PresentDestinationRefinementRequest{
		RefinementType: enumsGen.MicromobilityDestinationRefinementTypeNoRefinement,
		Destination:    destination,
	}

	resp, err := tc.presenter.PresentDestinationRefinement(tc.Ctx, request)

	presentationTestUtils.AssertResponseWithFile(t, resp, "testdata/no_refinement.json")
	assert.Nil(t, err)
})

t.Run("no_refinement_with_bug_fix", func(t *testing.T) {
	tc := setupPresenterTestClient(t)
	tc.localizationCtrlMock.Let().GetTranslator().Return(func(key, defaultVal string, values map[string]string) string {
		return defaultVal
	}, nil)
	tc.fliprControllerMock.Let().GetImageURL().Return(imageURLs, nil).Times(1)
	tc.fliprControllerMock.Let().
		GetBreezeM2Configuration().
		Return(
			entity.BreezeM2Configuration{
				NoRefinementMobileBugFixEnabled: true,
			},
			nil,
		).Times(1)

	request := entity.PresentDestinationRefinementRequest{
		RefinementType: enumsGen.MicromobilityDestinationRefinementTypeNoRefinement,
		Destination:    destination,
	}

	resp, err := tc.presenter.PresentDestinationRefinement(tc.Ctx, request)

	presentationTestUtils.AssertResponseWithFile(t, resp, "testdata/no_refinement_with_bug_fix.json")
	assert.Nil(t, err)
})
```

### Golden file testing — Example 22

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/controller/destination_refinement/destination_refinement_presenter_test.go`

```go
t.Run("direct_navigation", func(t *testing.T) {
	tc := setupPresenterTestClient(t)
	tc.localizationCtrlMock.Let().GetTranslator().Return(func(key, defaultVal string, values map[string]string) string {
		return defaultVal
	}, nil)
	tc.fliprControllerMock.Let().GetImageURL().Return(imageURLs, nil)

	request := entity.PresentDestinationRefinementRequest{
		RefinementType: enumsGen.MicromobilityDestinationRefinementTypeParkingRefinement,
		NavigationData: entity.NavigationData{
			DirectNavigation: &entity.DirectNavigation{
				DestinationBikingPath: commonEntity.UetaEstimate{
					DurationSeconds: 100,
					DistanceMeters:  200,
					Polyline:        "encoded_polyline",
				},
				IsVehicleBatteryInsufficient: false,
			},
		},
		Destination:          destination,
		Start:                start,
		ProviderUUID:         "provider_uuid",
		VehicleType:          commonpb.VEHICLE_TYPE_BIKE,
		VehicleRangeInMeters: ptr.Int32(10000),
	}

	resp, err := tc.presenter.PresentDestinationRefinement(tc.Ctx, request)

	presentationTestUtils.AssertResponseWithFile(t, resp, "testdata/direct_navigation.json")
	assert.Nil(t, err)
})
```

### Testability — Example 4

File: `src/code.uber.internal/rider/product/cx-activity/mapper/blisshydrator/lodging.go`

```go
func isValidLodgingPastOrder(in *ucommercepb.Order) bool {
	return isValidLodgingPastOrderAt(in, time.Now())
}

func isValidLodgingPastOrderAt(in *ucommercepb.Order, now time.Time) bool {
	booking := getHotelBooking(in)
	if booking == nil {
		return false
	}

	// Future canceled / failed orders should show up in the past section
	if in.GetStatus() == ucommercepb.ORDER_STATUS_REQUESTER_CANCELED ||
		in.GetStatus() == ucommercepb.ORDER_STATUS_PROVIDER_CANCELED ||
		in.GetStatus() == ucommercepb.ORDER_STATUS_FAILED {
		return true
	}

	location, err := time.LoadLocation(booking.GetTimezone())
	if err != nil {
		location = time.UTC
	}

	checkoutTime := combineDateAndTime(
		location,
		booking.GetCheckoutTime(),
		booking.GetListing().GetProperty().GetPropertyPolicies().GetCheckoutTime(),
	)
	if checkoutTime == nil {
		return false
	}

	return checkoutTime.Before(now)
}
```
