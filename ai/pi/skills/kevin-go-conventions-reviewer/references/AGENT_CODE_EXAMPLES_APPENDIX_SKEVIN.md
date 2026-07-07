# Agent Code Examples Appendix

## Appendix
### Parse, don’t verify

#### Example 1

File: `src/code.uber.internal/rider/product/cx-activity/mapper/blisshydrator/lodging.go`

```go
func getHotelBooking(in *ucommercepb.Order) *hotelbookingpb.Booking {
	ext, found := arrays.First(
		in.GetMarketData().GetDataExtensions().GetDataExtensions(),
		func(ext *marketdatapb.MarketData_DataExtensionsEntry) bool {
			return ext.GetKey().GetValue() == hotelBookingURN
		},
	)
	if !found {
		return nil
	}

	booking := &hotelbookingpb.Booking{}
	if err := proto.Unmarshal(ext.GetValue().GetValue(), booking); err != nil {
		return nil
	}

	return booking
}
```

#### Example 2

File: `src/code.uber.internal/rider/product/cx-activity/mapper/blisshydrator/lodging.go`

```go
func combineDateAndTime(
	location *time.Location,
	date *timepb.UnixTimeMillis,
	timeString string,
) *time.Time {
	if date == nil {
		return nil
	}

	result := time.UnixMilli(date.GetValue())
	t, err := time.ParseInLocation("3:04 PM", timeString, location)
	if err != nil {
		return &result
	}

	// Checkin / Checkout time are midnight UTC of booking dates, so we need to calculate the date in UTC.
	y, m, d := result.UTC().Date()
	return ptr.Of(time.Date(y, m, d, t.Hour(), t.Minute(), 0, 0, location))
}
```

#### Example 3

File: `src/code.uber.internal/rider/product/cx-activity/mapper/blisshydrator/lodging.go`

```go
func getLodgingData(in *ucommercepb.Order) *pastactivityentity.LodgingData {
	booking := getHotelBooking(in)
	if booking == nil {
		return nil
	}

	propertyBasic := booking.GetListing().GetProperty().GetPropertyBasic()
	policies := booking.GetListing().GetProperty().GetPropertyPolicies()
	timezone := booking.GetTimezone()
	location, err := time.LoadLocation(timezone)
	if err != nil {
		location = time.UTC
	}

	checkinTime := combineDateAndTime(
		location,
		booking.GetCheckinTime(),
		policies.GetCheckinBeginTime(),
	)
	checkoutTime := combineDateAndTime(
		location,
		booking.GetCheckoutTime(),
		policies.GetCheckoutTime(),
	)

	var imageURL string
	if images := propertyBasic.GetImages(); len(images) > 0 {
		imageURL = images[0].GetUrl()
	}

	return &pastactivityentity.LodgingData{
		PropertyName:     propertyBasic.GetName(),
		PropertyImageURL: imageURL,
		CheckinTime:      checkinTime,
		CheckoutTime:     checkoutTime,
	}
}
```

#### Example 10

File: `src/code.uber.internal/rider/platform/mobility-growth/comms-control/controller/comms-attribute/rider_session_info.go`

```go
for requiredParam, val := range requestParams {
	if val == nil || !val.GetBoolVal() {
		continue
	}

	switch requiredParam {
	case productSelectionLocation:
		attributeMap[pickupLat] = &pb.Attribute{Value: &pb.Attribute_FloatVal{FloatVal: productSelector.PickupLat}}
		attributeMap[pickupLng] = &pb.Attribute{Value: &pb.Attribute_FloatVal{FloatVal: productSelector.PickupLng}}
		attributeMap[destLat] = &pb.Attribute{Value: &pb.Attribute_FloatVal{FloatVal: productSelector.DestLat}}
		attributeMap[destLng] = &pb.Attribute{Value: &pb.Attribute_FloatVal{FloatVal: productSelector.DestLng}}

	case pickupDistanceInKm:
		if sessionInfo.DeviceLat != nil && sessionInfo.DeviceLng != nil {
			distance, _ := xmath.Haversine(*sessionInfo.DeviceLat, *sessionInfo.DeviceLng, productSelector.PickupLat, productSelector.PickupLng)
			attributeMap[requiredParam] = &pb.Attribute{Value: &pb.Attribute_FloatVal{FloatVal: distance / metersPerKm}}
		}

	case requestedPickupTimestampSec:
		productSelectorDetails := sessionInfo.InterestEvents.ProductSelectorDetails
		requestedPickupTimestamp := productSelectorDetails.RequestedPickupTimestampSec
		if requestedPickupTimestamp == 0 {
			requestedPickupTimestamp = time.UnixMilli(productSelector.AppEventTime).Unix()
		}
		attributeMap[requiredParam] = &pb.Attribute{
			Value: &pb.Attribute_StringVal{StringVal: strconv.FormatInt(requestedPickupTimestamp, 10)},
		}
	}
}
```

#### Example 14

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/controller/featureplugins/navigate.go`

```go
type navigationStrategy interface {
	NavigationType() NavigationType
	HasArrived() bool
	DestinationDetails() *plugins.DestinationDetails
	ArrivedAtCardConfig(
		ctx context.Context,
		translate entity.Translator,
		vehicleType mimodataschemas.VehicleType,
	) arrivedAtCardConfig
	HeadingToCardConfig(
		ctx context.Context,
		translate entity.Translator,
		vehicleType mimodataschemas.VehicleType,
	) headingToCardConfig
	NavigationDetailsDialogConfig(
		translate entity.Translator,
	) navigationDetailsDialogConfig
	BuildServerAction(
		ctx context.Context,
		p *navigatePresenter,
		req *PresentViewsRequest,
	) *mimodataschemas.EMobilityServerAction
}

type arrivedAtCardConfig struct {
	message  string
	infoTags []ui.View
}

type headingToCardConfig struct {
	message          string
	navigationTarget *geo.Point
	infoTags         []ui.View
}

type navigationDetailsDialogConfig struct {
	currentLocationEnabled bool
	stationItemEnabled     bool
	destinationName        *string
	stationText            string
	zone                   *entity.Zone
}
```

#### Example 18

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/controller/destination_refinement/destination_refinement_utils.go`

```go
type flowType string

const (
	flowTypeOutsideServiceArea               flowType = "OUTSIDE_SERVICE_AREA"
	flowTypeNavigationViaStation             flowType = "NAVIGATION_VIA_STATION"
	flowTypeDirectNavigation                 flowType = "DIRECT_NAVIGATION"
	flowTypeDirectNavigationToRestrictedArea flowType = "DIRECT_NAVIGATION_TO_RESTRICTED_AREA"
)

type refinementFlowInfoRequest struct {
	destination  entity.Point
	start        entity.Point
	providerUUID *string
	vehicleType  commonpb.VehicleType
}

type refinementFlowInfo struct {
	flowType                  flowType
	destinationRestrictedZone *entity.Zone
}

func (c *controller) getRefinementFlowInfo(
	ctx context.Context,
	request refinementFlowInfoRequest,
) (*refinementFlowInfo, error) {
	zonesResp, err := c.mimoZoneGateway.GetZonesByPoint(
		ctx,
		entity.GetZonesByPointRequest{
			Location: request.destination,
			Filters: entity.GetZonesByPointFilters{
				ProviderUUID: request.providerUUID,
			},
		},
	)
	if err != nil {
		return nil, gErrors.Wrapf(err, "Failed to get zones by point for destination")
	}

	zones := filterZonesByVehicleType(zonesResp.GetZones(), request.vehicleType)
	isInServiceArea := isDestinationInServiceArea(zones)
	isInMpz, err := c.calculateIsDestinationInMpz(
		ctx,
		request.providerUUID,
		request.start,
		zones,
		isInServiceArea,
		request.vehicleType,
	)
	if err != nil {
		return nil, err
	}

	shouldShowOSAPresentation := !isInServiceArea && !isInMpz
	destinationRestrictedZone := getDestinationRestrictedZone(zones)
	destinationRestrictedZone = c.getZoneGeometry(ctx, destinationRestrictedZone)

	flowType := flowTypeNavigationViaStation
	if shouldShowOSAPresentation {
		flowType = flowTypeOutsideServiceArea
	} else if isInMpz {
		flowType = flowTypeNavigationViaStation
	} else {
		if destinationRestrictedZone != nil {
			flowType = flowTypeDirectNavigationToRestrictedArea
		} else {
			flowType = flowTypeDirectNavigation
		}
	}

	return &refinementFlowInfo{
		flowType:                  flowType,
		destinationRestrictedZone: destinationRestrictedZone,
	}, nil
}
```

#### Example 25

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/entity/fare.go`

```go
// PricingPlan kinds
//
// MiMo pricing plans come in 3 kinds, determined by how the proto fields are populated:
//
//	 immediate_per_min — unlock fee, immediate per-min
//	   price > 0 (unlock fee)
//	   per_min_pricing: [{interval≥1, start_time=0, end_time=0}]
//	   → "$x to unlock, then $y/min"
//	   → UnlockFeeOriginalE5 > 0, FlatTiers empty, PerMinPricing[0].StartMinute == 0
//
//	 delayed_per_min — unlock fee, delayed per-min (e.g. Tembici)
//	   price > 0 (unlock fee covering a flat window)
//	   per_min_pricing: [{interval≥1, start_time=T, end_time=0}]
//	   → "$x for up to T min, then $y/min"
//	   → UnlockFeeOriginalE5 > 0, FlatTiers empty, PerMinPricing[0].StartMinute > 0
//
//	 flat_tier — explicit flat tiers, optional top-level unlock fee (e.g. Romania)
//	   price can be zero or non-zero
//	   per_min_pricing: [{interval=0, end_time=T1}, {interval=0, end_time=T2}, {interval≥1}]
//	   → "$x up to T1 min, $y up to T2 min, then $z/min"
//	   → FlatTiers non-empty; UnlockFeeOriginalE5 can be zero or non-zero

// TieredFareData is the unified parsed and discounted view of a pricing plan.
type TieredFareData struct {
	Currency             string
	UnlockFeeOriginalE5  int64 // Original unlock fee
	UnlockFeeRemainingE5 int64 // Unlock fee remaining after discounts (free unlock, U1 credits, promos)
	FlatTiers            []FlatTier
	PerMinTiers          []PerMinTier
	FreeMinutes          int32 // Number of free minutes due to discounts
}

// FlatTier is one flat-fee tier ending at EndMinute.
type FlatTier struct {
	EndMinute          int32
	TierFeeOriginalE5  int64 // Fee for this flat tier
	TierFeeRemainingE5 int64 // Fee for this flat tier after discounts
}

// PerMinTier is one per-minute pricing band starting at StartMinute.
type PerMinTier struct {
	StartMinute int32
	EndMinute   *int32 // nil for the final open-ended segment.
	RateE5      int64  // fee per interval of time. Ex: $1/min or $3 per 2 mins
	Interval    int32
}
```

### Top-down code structure

#### Example 7

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/controller/featureplugins/navigate_flow_direct_navigation.go`

```go
type directNavigationStrategy struct {
	destinationDetails plugins.DestinationDetails
	arrived            bool
}

func newDirectNavigationStrategy(
	ctx context.Context,
	p *navigatePresenter,
	req *PresentViewsRequest,
	destinationDetails plugins.DestinationDetails,
) navigationStrategy {
	userLocation, err := p.locationStoreGateway.GetLastKnownPosition(
		ctx,
		req.UserContext.UserUUID,
	)
	if err != nil {
		logger.FromContext(ctx).
			Warn("Failed to get user location", zap.Error(err))
	}

	arrived := err == nil &&
		hasUserReachedLocation(
			userLocation,
			geo.NewPoint(
				destinationDetails.GetLatitude(),
				destinationDetails.GetLongitude(),
			),
		)

	return &directNavigationStrategy{
		destinationDetails: destinationDetails,
		arrived:            arrived,
	}
}

func (s *directNavigationStrategy) NavigationType() NavigationType {
	return DirectNavigation
}

func (s *directNavigationStrategy) HasArrived() bool {
	return s.arrived
}

func (s *directNavigationStrategy) DestinationDetails() *plugins.DestinationDetails {
	return &s.destinationDetails
}
```

#### Example 9

File: `src/code.uber.internal/rider/product/cx-activity/controller/pastactivity/verticals/lodging/lodging.go`

```go
// Lodging is the interface for the lodging Vertical
type Lodging interface {
	verticals.Vertical
}

type lodging struct {
	abstractvertical.AbstractVertical
}

// Params is used for dependency injection
type Params struct {
	fx.In

	abstractvertical.AbstractVertical
}

// New constructs a new lodging Vertical
func New(p Params) (Lodging, error) {
	return &lodging{
		AbstractVertical: p.AbstractVertical,
	}, nil
}

func (v *lodging) GetTitle(
	ctx context.Context,
	order pastactivityentity.PastOrderData,
	params pastactivityentity.BuilderParams,
) string {
	return ptr.GetOrZero(order.LodgingData).PropertyName
}

func (v *lodging) GetThumbnailImageURL(
	ctx context.Context,
	order pastactivityentity.PastOrderData,
	params pastactivityentity.BuilderParams,
) string {
	return ptr.GetOrZero(order.LodgingData).PropertyImageURL
}
```

#### Example 16

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/mapper/station.go`

```go
func getPresentationThrift(ctx context.Context, req presentStationRequest) *genTypesV2.EMobilityStationPresentation {
	return &genTypesV2.EMobilityStationPresentation{
		MapPresentation:           getMapPresentationThrift(req),
		StationCardPresentation:   getStationCardPresentationThrift(ctx, req),
		MapMarkerModels:           getMapMarkerModelsThrift(ctx, req),
		CardPresentationContainer: getCardPresentationContainerThrift(req),
		SelectedMapMarkerModels:   getSelectedMapMarkerModelsThrift(ctx, req),
	}
}

func getMapPresentationThrift(req presentStationRequest) *genTypesV2.MapPresentation {
	switch req.zone.Category {
	case zonespb.CATEGORY_DOCKING_STATION:
		return getMapPresentationForDockingStationThrift(req)
	case zonespb.CATEGORY_PARKING_PIN:
		return getMapPresentationForParkingPinThrift(req.imageURLs)
	}
	return nil
}

func getMapPresentationForParkingPinThrift(imageURLs *entity.ImageURL) *genTypesV2.MapPresentation {
	var urlImage *illustration.URLImage
	if imageURLs != nil {
		urlImage = &illustration.URLImage{
			DayImageUrl:   imageURLs.MapParkingPinSelectedIconDayImageURL,
			NightImageUrl: imageURLs.MapParkingPinSelectedIconNightImageURL,
		}
	}

	return &genTypesV2.MapPresentation{
		MapPinSelectedIcon: urlImage,
	}
}
```

#### Example 17

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/controller/destination_refinement/destination_refinement.go`

```go
type Controller interface {
	GetDestinationRefinement(
		ctx context.Context,
		request entity.GetDestinationRefinementRequest,
	) (*entity.GetDestinationRefinementResponse, error)
}

type controller struct {
	fliprController         flipr.Controller
	localizationController  localization.Controller
	riderMapSearchV2Gateway ridermapsearchv2.Gateway
	mimovehiclesGateway     mimovehicles.Gateway
	locationStoreGateway    locationstore.Gateway
	mimoZoneGateway         mimozones.Gateway
	rentalGateway           riderrental.Gateway
	uetaGateway             ueta.Gateway
	presenter               Presenter
}

func (c *controller) GetDestinationRefinement(
	ctx context.Context,
	request entity.GetDestinationRefinementRequest,
) (*entity.GetDestinationRefinementResponse, error) {
	userUUID := utils.GetUserUUIDFromContext(ctx)

	// 1. Get user's booking
	rentalResp, err := c.rentalGateway.GetUserLatestRental(
		ctx,
		entity.GetUserLatestRentalRequest{
			UserUUID:         userUUID,
			SkipVehicleFetch: false,
		},
	)
	if err != nil {
		return nil, gErrors.Wrapf(err, "Failed to get user's rental")
	}

	if rentalResp == nil || rentalResp.Rental == nil || !presentationutils.UserOnTrip(rentalResp.Rental.Status) {
		return c.getPreTripDestinationRefinement(ctx, request)
	}

	return c.getOnTripDestinationRefinement(ctx, request, rentalResp)
}
```

### Unit test design

#### Example 5

File: `src/code.uber.internal/rider/product/cx-activity/mapper/blisshydrator/lodging_test.go`

```go
func Test_isValidLodgingPastOrderAt(t *testing.T) {
	t.Parallel()

	currentTime := time.Date(2026, 7, 2, 9, 0, 0, 0, nycLocation) // 9 AM, June 2 NY time
	pastMs := currentTime.Add(-24 * time.Hour).UnixMilli()
	futureMs := currentTime.Add(24 * time.Hour).UnixMilli()
	checkoutDateMs := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC).UnixMilli() // June 2

	withOrderStatus := func(
		order *ucommercepb.Order,
		status ucommercepb.OrderStatus,
	) *ucommercepb.Order {
		order.Status = status
		return order
	}

	tests := []struct {
		name     string
		order    *ucommercepb.Order
		expected bool
	}{
		{
			name:     "should_return_false_when_no_booking_data_extension",
			order:    &ucommercepb.Order{},
			expected: false,
		},
		{
			name:     "should_return_false_when_checkout_time_is_zero",
			order:    buildOrderWithHotelBooking(minHotelBooking),
			expected: false,
		},
		{
			name: "should_return_false_when_checkout_time_is_in_the_future",
			order: buildOrderWithHotelBooking(&hotelbookingpb.Booking{
				CheckoutTime: &timepb.UnixTimeMillis{Value: futureMs},
				Timezone:     "America/New_York",
			}),
			expected: false,
		},
		{
			name: "should_return_false_when_checkout_policy_time_is_later_today",
			order: buildOrderWithHotelBooking(&hotelbookingpb.Booking{
				CheckoutTime: &timepb.UnixTimeMillis{Value: checkoutDateMs},
				Timezone:     "America/New_York",
				Listing: &hotelbookingpb.Listing{
					Property: &hotelbookingpb.Property{
						PropertyPolicies: &hotelbookingpb.PropertyPolicies{
							CheckoutTime: "12:00 PM",
						},
					},
				},
			}),
			expected: false,
		},
		{
			name: "should_return_true_when_checkout_time_is_in_the_past",
			order: buildOrderWithHotelBooking(&hotelbookingpb.Booking{
				CheckoutTime: &timepb.UnixTimeMillis{Value: pastMs},
				Timezone:     "America/New_York",
			}),
			expected: true,
		},
		{
			name: "should_return_true_when_timezone_is_invalid_and_checkout_time_is_in_the_past",
			order: buildOrderWithHotelBooking(&hotelbookingpb.Booking{
				CheckoutTime: &timepb.UnixTimeMillis{Value: checkoutDateMs},
				Timezone:     "not-a-timezone",
			}),
			expected: true,
		},
		{
			name: "should_return_true_when_requester_canceled_even_if_checkout_is_in_the_future",
			order: withOrderStatus(
				buildOrderWithHotelBooking(&hotelbookingpb.Booking{
					CheckoutTime: &timepb.UnixTimeMillis{Value: futureMs},
					Timezone:     "America/New_York",
				}),
				ucommercepb.ORDER_STATUS_REQUESTER_CANCELED,
			),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tt.expected, isValidLodgingPastOrderAt(tt.order, currentTime))
		})
	}
}
```

#### Example 6

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/controller/featureplugins/navigate_utils_test.go`

```go
func Test_getNavigationType(t *testing.T) {
	t.Parallel()

	destinationDetails := &plugins.DestinationDetails{
		Latitude:  ptr.Float64(1.0),
		Longitude: ptr.Float64(2.0),
		Name:      ptr.String("destination"),
	}

	parkingCoordinates := &plugins.Point{
		Latitude:  ptr.Float64(1.1),
		Longitude: ptr.Float64(2.1),
	}

	tests := []struct {
		name  string
		state *plugins.NavigateFeatureState
		want  NavigationType
	}{
		{
			name: "should_return_NavigationViaStation_when_destination_and_selected_station_set",
			state: &plugins.NavigateFeatureState{
				DestinationDetails:  destinationDetails,
				SelectedStationUUID: ptr.String("station-uuid"),
				ParkingCoordinates:  nil,
			},
			want: NavigationViaStation,
		},
		{
			name: "should_return_DirectNavigationToRestrictedArea_when_destination_and_parking_coords_set",
			state: &plugins.NavigateFeatureState{
				DestinationDetails:  destinationDetails,
				SelectedStationUUID: nil,
				ParkingCoordinates:  parkingCoordinates,
			},
			want: DirectNavigationToRestrictedArea,
		},
		{
			name: "should_return_DirectNavigation_when_destination_set_without_station_or_parking",
			state: &plugins.NavigateFeatureState{
				DestinationDetails:  destinationDetails,
				SelectedStationUUID: nil,
				ParkingCoordinates:  nil,
			},
			want: DirectNavigation,
		},
		{
			name: "should_return_SelectedStationOnly_when_only_selected_station_set",
			state: &plugins.NavigateFeatureState{
				DestinationDetails:  nil,
				SelectedStationUUID: ptr.String("station-uuid"),
				ParkingCoordinates:  nil,
			},
			want: SelectedStationOnly,
		},
		{
			name: "should_return_NoActiveNavigation_when_all_fields_empty",
			state: &plugins.NavigateFeatureState{
				DestinationDetails:  nil,
				SelectedStationUUID: nil,
				ParkingCoordinates:  nil,
			},
			want: NoActiveNavigation,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := getNavigationType(tt.state)
			assert.Equal(t, tt.want, got)
		})
	}
}
```

#### Example 11

File: `src/code.uber.internal/rider/platform/mobility-growth/comms-control/controller/comms-attribute/rider_session_info_test.go`

```go
{
	name:        "Success with fare UUIDs set",
	docstoreErr: nil,
	isVerbose:   false,
	docstoreRes: []*entity.RiderSessionSignal{func() *entity.RiderSessionSignal {
		fareSessionUUID := uuid.FromStringOrNil("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
		fareFlowUUID := uuid.FromStringOrNil("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
		fareRequestUUID := uuid.FromStringOrNil("cccccccc-cccc-cccc-cccc-cccccccccccc")
		s := getRiderSignal()
		s.InterestEvents.ProductSelectorDetails.FareSessionUUID = &fareSessionUUID
		s.InterestEvents.ProductSelectorDetails.FareFlowUUID = &fareFlowUUID
		s.InterestEvents.ProductSelectorDetails.FareRequestUUID = &fareRequestUUID
		return s
	}()},
	safariErr: nil,
	safariRes: territory,
	req: &pb.GetAttributeRequest{
		AttributeName: common.RiderSessionInfoAttribute,
		Namespace:     common.RiderAbandon,
		ClientUuid: &pb_common.UUID{
			Value: "7841b703-c8cb-4f79-b4ca-13ca4508d168",
		},
		RequestParams: map[string]*pb.Attribute{
			fareID:      &pb.Attribute{Value: &pb.Attribute_BoolVal{BoolVal: true}},
			vvidFareMap: &pb.Attribute{Value: &pb.Attribute_BoolVal{BoolVal: true}},
		},
	},
	want: &pb.GetAttributeResponse{
		Status: &pb.Status{},
		ResponseParams: map[string]*pb.Attribute{
			fareID: &pb.Attribute{Value: &pb.Attribute_StringMapVal{StringMapVal: &pb.MapTypeString{MapString: map[string]string{
				lifecycleID: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
				contextID:   "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
				requestID:   "cccccccc-cccc-cccc-cccc-cccccccccccc",
			}}}},
			vvidFareMap: &pb.Attribute{Value: &pb.Attribute_StringMapVal{StringMapVal: &pb.MapTypeString{MapString: map[string]string{
				"123": "23",
			}}}},
		},
	},
}
```

#### Example 19

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/controller/destination_refinement/destination_refinement_test.go`

```go
type testClient struct {
	*ctesting.TestClient

	controller           controller
	fliprMock            *fliprMock.Mock
	localizationMock     *localizationMock.Mock
	riderMapSearchV2Mock *riderMapSearchV2Mock.Mock
	mimovehiclesMock     *mimovehiclesMock.Mock
	locationStoreMock    *locationStoreMock.Mock
	mimoZonesMock        *mimoZonesMock.Mock
	riderRentalMock      *riderRentalMock.Mock
	uetaMock             *uetaMock.Mock
	presenterMock        *presenterMock.Mock
}

func setupTestClient(t *testing.T) testClient {
	base := ctesting.NewTestClient(t)

	base.Ctx = testutils.AddYarpcHeadersToContext(
		base.Ctx,
		map[string]string{
			constants.XUberUUID:          _userUUID.String(),
			constants.XUberRegionID:      strconv.Itoa(int(_cityID)),
			constants.XUberDevice:        _device,
			constants.XUberClientVersion: _clientVersion,
		},
	)

	fliprMock := fliprMock.New(t)
	localizationMock := localizationMock.New(t)
	riderMapSearchV2Mock := riderMapSearchV2Mock.New(t)
	mimovehiclesMock := mimovehiclesMock.New(t)
	locationStoreMock := locationStoreMock.New(t)
	mimoZonesMock := mimoZonesMock.New(t)
	riderRentalMock := riderRentalMock.New(t)
	uetaMock := uetaMock.New(t)
	presenterMock := presenterMock.New(t)

	controller := controller{
		fliprController:         fliprMock.Build(),
		localizationController:  localizationMock.Build(),
		riderMapSearchV2Gateway: riderMapSearchV2Mock.Build(),
		mimovehiclesGateway:     mimovehiclesMock.Build(),
		locationStoreGateway:    locationStoreMock.Build(),
		mimoZoneGateway:         mimoZonesMock.Build(),
		rentalGateway:           riderRentalMock.Build(),
		uetaGateway:             uetaMock.Build(),
		presenter:               presenterMock.Build(),
	}

	return testClient{
		TestClient:           base,
		controller:           controller,
		fliprMock:            fliprMock,
		localizationMock:     localizationMock,
		riderMapSearchV2Mock: riderMapSearchV2Mock,
		mimovehiclesMock:     mimovehiclesMock,
		locationStoreMock:    locationStoreMock,
		mimoZonesMock:        mimoZonesMock,
		riderRentalMock:      riderRentalMock,
		uetaMock:             uetaMock,
		presenterMock:        presenterMock,
	}
}
```

#### Example 24

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/mapper/station_test.go`

```go
func TestGetPrimaryCTABreezeM1Enabled(t *testing.T) {
	t.Parallel()

	type args struct {
		zone         entity.Zone
		rentalStatus mimodataschemas.RentalStatus
	}
	type expected struct {
		ctaType        genEnum.CTATypeV2
		ctaText        string
		analyticsID    string
		hasExecuteCall bool
	}
	tests := []struct {
		name     string
		args     args
		expected expected
	}{
		{
			name: "should_return_dismiss_cta_when_parking_pin_pre_trip",
			args: args{
				zone:         presentationtestutils.CreateZone(zonespb.CATEGORY_PARKING_PIN, false, nil),
				rentalStatus: mimodataschemas.RentalStatusPreTrip,
			},
			expected: expected{
				ctaType:     genEnum.CTATypeV2Dismiss,
				ctaText:     "Ok",
				analyticsID: "mimo-station-card-primary-cta-ok",
			},
		},
		{
			name: "should_return_scan_to_ride_cta_when_docking_station_pre_trip_online",
			args: args{
				zone:         presentationtestutils.CreateZone(zonespb.CATEGORY_DOCKING_STATION, true, nil),
				rentalStatus: mimodataschemas.RentalStatusPreTrip,
			},
			expected: expected{
				ctaType:     genEnum.CTATypeV2ScanToRide,
				ctaText:     "Scan to ride",
				analyticsID: "mimo-station-card-primary-cta-scan-to-ride",
			},
		},
		{
			name: "should_return_dismiss_cta_when_docking_station_on_trip_offline",
			args: args{
				zone:         presentationtestutils.CreateZone(zonespb.CATEGORY_DOCKING_STATION, false, nil),
				rentalStatus: mimodataschemas.RentalStatusOnTrip,
			},
			expected: expected{
				ctaType:     genEnum.CTATypeV2Dismiss,
				ctaText:     "Got it",
				analyticsID: "mimo-station-card-primary-cta-got-it",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			expectedCTA := &genTypesV2.MicromobilityCTA{
				CtaTypeV2: &tt.expected.ctaType,
				CtaText: &text.StyledText{
					Text: tt.expected.ctaText,
				},
				AnalyticsID: &tt.expected.analyticsID,
			}
			mocks, assertAll := getStationMocks(t)
			defer assertAll()

			mocks.fliprControllerMock.Let().
				GetBreezeM1Enabled().
				Return(true, nil).
				AnyTimes()
			cta := getPrimaryCTA(
				context.Background(),
				mocks.fliprControllerMock.Build(),
				getStationMockTranslator(),
				tt.args.zone,
				tt.args.rentalStatus,
				ptr.Of(mimodataschemas.VehicleTypeBike),
			)
			assert.Equal(t, cta, expectedCTA)
		})
	}
}
```

### Mocks

#### Example 12

File: `src/code.uber.internal/rider/platform/mobility-growth/comms-control/controller/comms-attribute/rider_session_info_test.go`

```go
for _, tt := range tests {
	t.Run(tt.name, func(t *testing.T) {
		t.Parallel()
		mockFlipr := fliprGateway.New(t)
		if tt.isVerbose {
			mockFlipr.Let().GetArrayVal().Return([]string{"7841b703-c8cb-4f79-b4ca-13ca4508d168"}, nil).AnyTimes()
		} else {
			mockFlipr.Let().GetArrayVal().Return([]string{}, nil).AnyTimes()
		}
		mockFlipr.Let().GetStringValue().Return(common.RunModeOff, nil).AnyTimes()

		mockDocstore := docstore.New(t)
		mockDocstore.Let().GetRiderSessionSignal().Return(tt.docstoreRes, tt.docstoreErr).AnyTimes()

		mockSafariGateway := safariGateway.New(t)
		mockSafariGateway.Let().GetTerritory().Return(tt.safariRes, tt.safariErr).MaxTimes(1)

		mockDataAccessOm := dataAcessOmGateway.New(t)
		logisticGateway, _ := lg.New(logisticsmock.New(t).Build())
		mocktrident := trident.New(t)
		mocktrident.Let().GetTripsWithOptions().Return(nil, nil).AnyTimes()

		controller := New(
			mockFlipr.Build(),
			logisticGateway,
			omGateway.New(t).Build(),
			mockDataAccessOm.Build(),
			walletGateway.New(t).Build(),
			nil,
			nil,
			tally.NoopScope,
			mockDocstore.Build(),
			mockSafariGateway.Build(),
			nil,
			nil,
			membershipGateway.New(t).Build(),
			mocktrident.Build(),
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
		)
		require.NotNil(t, controller)

		got, err := controller.GetAttribute(context.Background(), tt.req)
		if tt.wantErr {
			assert.Error(t, err)
		} else {
			assert.Equal(t, tt.want, got)
		}
	})
}
```

### Feature flags

#### Example 15

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/mapper/station.go`

```go
type presentStationRequest struct {
	fliprController                flipr.Controller
	translator                     entity.Translator
	zone                           entity.Zone
	rentalStatus                   mimodataschemas.RentalStatus
	vehicleType                    *mimodataschemas.VehicleType
	imageURLs                      *entity.ImageURL
	isParkingPinSpotDetailsEnabled bool
}

func ProtoStationsToThrift(ctx context.Context, fliprController flipr.Controller, req entity.ProtoStationsToThriftRequest) *genTypesV2.EMobilityStation {

	imageURLs, _ := fliprController.GetImageURL(ctx, entity.FliprParams{
		ProviderUUID: ptr.String(req.Zone.ProviderUuid.GetValue()),
		CityID:       ptr.Of(utils.GetCityIDFromContext(ctx)),
	})
	isParkingPinSpotDetailsEnabled, _ := fliprController.GetParkingPinSpotDetailsEnabled(ctx, entity.FliprParams{
		CityID:        ptr.Of(utils.GetCityIDFromContext(ctx)),
		UserUUID:      ptr.Of(utils.GetUserUUIDFromContext(ctx)),
		UserTags:      utils.ConvertCommaSeparatedStringToSlice(utils.GetValueFromContext(ctx, constants.XUberUserTags, "")),
		Device:        ptr.String(utils.GetDeviceFromContext(ctx)),
		DeviceVersion: ptr.String(utils.GetClientVersionFromContext(ctx)),
	})

	presentStationRequest := presentStationRequest{
		fliprController:                fliprController,
		translator:                     req.Translator,
		zone:                           req.Zone,
		rentalStatus:                   req.RentalStatus,
		vehicleType:                    req.VehicleType,
		imageURLs:                      imageURLs,
		isParkingPinSpotDetailsEnabled: isParkingPinSpotDetailsEnabled,
	}
	station := &genTypesV2.EMobilityStation{
		ID:                   req.Zone.Uuid.GetValue(),
		ProviderID:           req.Zone.ProviderUuid.GetValue(),
		ServiceAreaId:        req.Zone.ProviderUuid.GetValue(),
		StationState:         ProtoStationStateToThrift(req.Zone.StationProperties, &req.Zone.Category),
		Location:             getLocationThrift(req.Zone.Geometry),
		Traits:               &genTypesV2.EMobilityStationTraits{},
		Presentation:         getPresentationThrift(ctx, presentStationRequest),
		StationAnalyticsInfo: getStationAnalyticsInfo(ctx, req.Zone, req.RentalStatus, req.VehicleType),
	}
	station.Traits.Sortable = &genTypesV2.EMobilityStationSortableTrait{
		Trait:               genEnum.EMobilityStationTraitSortable,
		EuclideanDistanceKm: ptr.Float64(0),
	}

	if station.GetLocation() != nil {
		station.Traits.Sortable.EuclideanDistanceKm = geoutils.GetHaversineDistanceKm(req.SearchCenterPoint, golangGeo.NewPoint(station.GetLocation().GetLatitude(), station.GetLocation().GetLongitude()))
	}

	station.StationType = GetStationTypeFromZone(req.Zone)

	return station
}
```

### Golden file testing

#### Example 23

File: `src/code.uber.internal/rider/presentation/micromobility/rider-presentation/testutils/assert.go`

```go
func AssertResponseWithFile[T any](t *testing.T, response *T, filename string) {
	fileData, err := os.ReadFile(filename)
	if err != nil {
		assert.Failf(t, "Failed to load file", "filename: %s, error: %v", filename, err)
	}
	var expectedResponse T
	err = json.Unmarshal(fileData, &expectedResponse)
	if err != nil {
		assert.Failf(t, "Failed to unmarshall expected response", "error: %v", err)
	}

	//  Note: To update the testdata, uncomment the lines below
	// jsonData, err := json.MarshalIndent(response, "", "  ")
	// if err != nil {
	// 	assert.Failf(t, "Failed to marshall actual response", "error: %v", err)
	// }
	// err = os.WriteFile(filename, jsonData, 0644)
	// if err != nil {
	// 	assert.Failf(t, "Failed to write to file", "error: %v", err)
	// }
	// return

	respData, err := json.Marshal(response)
	if err != nil {
		assert.Failf(t, "Failed to marshall actual response", "error: %v", err)
	}

	var actualResponse T
	err = json.Unmarshal(respData, &actualResponse) // Unmarshal to get rid of the `omitempty` fields
	if err != nil {
		assert.Failf(t, "Failed to unmarshall actual response", "error: %v", err)
	}
	assert.Equal(t, expectedResponse, actualResponse)
}
```
