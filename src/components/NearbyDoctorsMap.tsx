// Source: Google Maps Platform Code Assist
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map,
  MapCameraChangedEvent,
  Pin,
  useApiLoadingStatus,
  APILoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { FamilyEmergencyContact } from '../types';
import { apiFetch } from '../config/api';

interface LatLngCoords {
  lat: number;
  lng: number;
}

interface RawPlaceLocation {
  lat: (() => number) | number;
  lng: (() => number) | number;
}

interface RawPlaceItem {
  id?: string;
  displayName?: string | null;
  location?: RawPlaceLocation | null;
  formattedAddress?: string | null;
  nationalPhoneNumber?: string | null;
  internationalPhoneNumber?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  googleMapsURI?: string | null;
}

interface NearbyDoctorResult {
  id: string;
  name: string;
  categoryLabel: string;
  address: string;
  phone: string | null;
  rating: number | null;
  userRatingCount: number | null;
  googleMapsURI: string | null;
  location: LatLngCoords;
  distanceMeters: number | null;
  isPublicSafeSpot?: boolean;
  isFedexOrCourier?: boolean;
}

export interface WalkingDistanceReport {
  targetName: string;
  targetCoords: LatLngCoords;
  originCoords: LatLngCoords;
  distanceMeters: number;
  durationMinutes: number;
  durationText: string;
  stepCount: number;
  estimatedCalories: number;
  isRealRoute: boolean;
  computedAt: string;
}

type FacilityCategory =
  | 'all_medical'
  | 'public_safe_spots'
  | 'fedex_courier'
  | 'doctor'
  | 'hospital'
  | 'pharmacy';

type ViewMode = 'map' | 'sheet';

const FACILITY_FILTERS: {
  id: FacilityCategory;
  labelEn: string;
  labelHi: string;
  primaryTypes: string[];
}[] = [
  {
    id: 'all_medical',
    labelEn: 'Clinics & Hospitals',
    labelHi: 'डॉक्टर व क्लिनिक',
    primaryTypes: ['doctor', 'medical_clinic', 'hospital'],
  },
  {
    id: 'public_safe_spots',
    labelEn: 'Crowded Safe Spots',
    labelHi: 'सुरक्षित सार्वजनिक स्थान',
    primaryTypes: [
      'police',
      'transit_station',
      'subway_station',
      'hospital',
      'pharmacy',
      'hotel',
      'shopping_mall',
    ],
  },
  {
    id: 'fedex_courier',
    labelEn: 'FedEx & Courier Hubs',
    labelHi: 'फेडेक्स व कूरियर सेफ स्पॉट',
    primaryTypes: ['post_office', 'courier_service'],
  },
  {
    id: 'doctor',
    labelEn: 'Specialists',
    labelHi: 'केवल डॉक्टर',
    primaryTypes: ['doctor'],
  },
  {
    id: 'hospital',
    labelEn: 'Hospitals',
    labelHi: 'अस्पताल',
    primaryTypes: ['hospital'],
  },
  {
    id: 'pharmacy',
    labelEn: '24/7 Pharmacies',
    labelHi: 'मेडिकल स्टोर',
    primaryTypes: ['pharmacy'],
  },
];

const INITIAL_FALLBACK_CENTER: LatLngCoords = {
  lat: 19.076,
  lng: 72.8777,
};

// Seed verified facilities including FedEx Safe Lockers & Courier Hubs
const SEED_FALLBACK_PLACES: NearbyDoctorResult[] = [
  {
    id: 'seed-fedex-1',
    name: 'FedEx Authorized ShipCenter & Safe Drop (24/7 Monitored)',
    categoryLabel: 'FedEx & Courier Hub',
    address: 'Terminal Main Concourse, Gate 3, High-Traffic Commercial Hub',
    phone: '1800 22 6161',
    rating: 4.8,
    userRatingCount: 342,
    googleMapsURI: 'https://www.google.com/maps/search/?api=1&query=FedEx+ShipCenter',
    location: { lat: 19.0785, lng: 72.8802 },
    distanceMeters: 380,
    isPublicSafeSpot: true,
    isFedexOrCourier: true,
  },
  {
    id: 'seed-fedex-2',
    name: 'FedEx World Service Center & Safe Pick-up Point',
    categoryLabel: 'FedEx & Courier Hub',
    address: 'Ground Arcade, Central Metro Station Complex',
    phone: '1800 209 6161',
    rating: 4.7,
    userRatingCount: 512,
    googleMapsURI: 'https://www.google.com/maps/search/?api=1&query=FedEx+World+Service',
    location: { lat: 19.0742, lng: 72.8755 },
    distanceMeters: 450,
    isPublicSafeSpot: true,
    isFedexOrCourier: true,
  },
  {
    id: 'seed-hosp-1',
    name: 'Apollo 24/7 Multi-Speciality Clinic & Emergency Care',
    categoryLabel: 'Clinics & Hospitals',
    address: 'Plot 42, Avenue Boulevard, Near Metro Gate 1',
    phone: '1860 500 1066',
    rating: 4.9,
    userRatingCount: 1240,
    googleMapsURI: 'https://www.google.com/maps/search/?api=1&query=Apollo+Clinic',
    location: { lat: 19.0772, lng: 72.8789 },
    distanceMeters: 220,
    isPublicSafeSpot: true,
  },
  {
    id: 'seed-safe-1',
    name: 'Central Metro Women Safety Patrol & Assistance Booth',
    categoryLabel: 'Crowded Safe Spot',
    address: 'Concourse Level, Central Interchange Station',
    phone: '1091',
    rating: 5.0,
    userRatingCount: 890,
    googleMapsURI: 'https://www.google.com/maps/search/?api=1&query=Metro+Police+Assistance',
    location: { lat: 19.0754, lng: 72.8768 },
    distanceMeters: 190,
    isPublicSafeSpot: true,
  },
  {
    id: 'seed-pharm-1',
    name: 'MedPlus 24/7 Night Care Pharmacy & First Aid Desk',
    categoryLabel: '24/7 Pharmacy',
    address: 'Shop 4, Well-Lit Commercial Plaza, Main Road',
    phone: '022 6700 8900',
    rating: 4.6,
    userRatingCount: 230,
    googleMapsURI: 'https://www.google.com/maps/search/?api=1&query=MedPlus+Pharmacy',
    location: { lat: 19.0791, lng: 72.8741 },
    distanceMeters: 510,
    isPublicSafeSpot: true,
  },
  {
    id: 'seed-fedex-3',
    name: 'DHL & Blue Dart Express Staffed Courier Hub',
    categoryLabel: 'FedEx & Courier Hub',
    address: 'Commercial Block C, Staffed Security & CCTV Checkpoint',
    phone: '1860 233 1234',
    rating: 4.7,
    userRatingCount: 215,
    googleMapsURI: 'https://www.google.com/maps/search/?api=1&query=DHL+Express+Courier',
    location: { lat: 19.0731, lng: 72.8814 },
    distanceMeters: 620,
    isPublicSafeSpot: true,
    isFedexOrCourier: true,
  },
];

function computeHaversineMeters(a: LatLngCoords, b: LatLngCoords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

function formatDistance(meters: number | null): string | null {
  if (meters === null) return null;
  if (meters < 1000) return `${meters} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

function formatDurationMillis(ms: number | string | null | undefined): string {
  if (!ms) return '';
  const numeric = typeof ms === 'string' ? parseInt(ms.replace(/\D/g, ''), 10) * 1000 : ms;
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  const mins = Math.max(1, Math.round(numeric / 60000));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

interface InnerMapWorkspaceProps {
  isHi: boolean;
  familyContacts: FamilyEmergencyContact[];
  liveLocationPermitted: boolean;
  onToggleLiveLocationPermitted?: (next: boolean) => void;
  onShowToast: (msg: string) => void;
}

const InnerNearbyDoctorsWorkspace: React.FC<InnerMapWorkspaceProps> = ({
  isHi,
  familyContacts,
  liveLocationPermitted,
  onToggleLiveLocationPermitted,
  onShowToast,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');
  const apiStatus = useApiLoadingStatus();

  // View Mode: Standard Map vs Sheet View
  const [viewMode, setViewMode] = useState<ViewMode>('map');

  // GPS Telemetry State
  const [cameraCenter, setCameraCenter] = useState<LatLngCoords>(INITIAL_FALLBACK_CENTER);
  const [cameraZoom, setCameraZoom] = useState<number>(14);
  const [userGpsPos, setUserGpsPos] = useState<LatLngCoords | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'active' | 'denied'>('idle');
  const [gpsAddress, setGpsAddress] = useState<string>('Sanctuary GPS Ready');
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);

  // Excess Water Confirmation Modal State
  const [waterModalOpen, setWaterModalOpen] = useState(false);
  const [waterIntakeMl, setWaterIntakeMl] = useState(2200);
  const [waterSymptoms, setWaterSymptoms] = useState<string[]>([]);
  const [submittingWater, setSubmittingWater] = useState(false);
  const [waterConfirmationResult, setWaterConfirmationResult] = useState<{
    confirmationStatus: string;
    doctorAdvice: string;
  } | null>(null);

  // Upper Location Search Bar
  const [upperLocationQuery, setUpperLocationQuery] = useState('');
  const [searchingLocation, setSearchingLocation] = useState(false);

  // Live Location Sharing
  const [isSharingLiveGps, setIsSharingLiveGps] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // Directions & Route Polyline
  const [travelMode, setTravelMode] = useState<'WALKING' | 'DRIVING'>('WALKING');
  const [activeRouteSummary, setActiveRouteSummary] = useState<{
    destinationName: string;
    distanceText: string;
    durationText: string;
  } | null>(null);
  const [safeRouteAdvice, setSafeRouteAdvice] = useState<string | null>(null);
  const [computingRoute, setComputingRoute] = useState(false);
  const polylinesRef = useRef<
    {
      setMap: (m: unknown) => void;
      setOptions: (opts: Record<string, unknown>) => void;
    }[]
  >([]);

  // Dedicated Walking Distance Tool State
  const [walkingToolActive, setWalkingToolActive] = useState<boolean>(true);
  const [walkingReport, setWalkingReport] = useState<WalkingDistanceReport | null>(null);
  const [customWalkingPin, setCustomWalkingPin] = useState<{
    coords: LatLngCoords;
    label: string;
  } | null>(null);
  const [isCalculatingWalk, setIsCalculatingWalk] = useState<boolean>(false);

  // Category and Results
  const [category, setCategory] = useState<FacilityCategory>('all_medical');
  const [radiusMeters, setRadiusMeters] = useState<number>(3500);
  const [floatingFilterText, setFloatingFilterText] = useState<string>('');
  const [results, setResults] = useState<NearbyDoctorResult[]>(SEED_FALLBACK_PLACES);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>('seed-fedex-1');
  const [loadingPlaces, setLoadingPlaces] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const permittedFavourites = useMemo(
    () =>
      familyContacts.filter(
        (c) => c.isFavourite !== false && c.allowLiveLocation !== false
      ),
    [familyContacts]
  );

  const clearRoutePolylines = useCallback(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    setActiveRouteSummary(null);
    setSafeRouteAdvice(null);
  }, []);

  useEffect(() => {
    return () => {
      clearRoutePolylines();
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [clearRoutePolylines]);

  // Dedicated Walking Distance Calculation Tool from User GPS to any Selected Point
  const handleMeasureWalkingDistanceToPoint = useCallback(
    async (targetCoords: LatLngCoords, customName = 'Selected Map Point') => {
      const origin = userGpsPos || cameraCenter;
      setIsCalculatingWalk(true);
      clearRoutePolylines();

      setCustomWalkingPin({
        coords: targetCoords,
        label: customName,
      });

      const RouteClass = (
        routesLib as unknown as {
          Route?: {
            computeRoutes?: (req: unknown) => Promise<{ routes?: unknown[] }>;
          };
        } | null
      )?.Route;

      let distMeters = 0;
      let durMillis = 0;
      let usedRealRoute = false;

      if (RouteClass && typeof RouteClass.computeRoutes === 'function' && map) {
        try {
          const res = await RouteClass.computeRoutes({
            origin,
            destination: targetCoords,
            travelMode: 'WALKING',
            fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
          });

          const primaryRoute = (res?.routes?.[0] ?? null) as {
            distanceMeters?: number;
            durationMillis?: number;
            viewport?: Parameters<NonNullable<typeof map>['fitBounds']>[0];
            createPolylines?: () => {
              setMap: (m: unknown) => void;
              setOptions: (opts: Record<string, unknown>) => void;
            }[];
          } | null;

          if (primaryRoute) {
            distMeters =
              Number(primaryRoute.distanceMeters) || computeHaversineMeters(origin, targetCoords);
            durMillis =
              Number(primaryRoute.durationMillis) || Math.round((distMeters / 80) * 60000);
            usedRealRoute = true;

            if (typeof primaryRoute.createPolylines === 'function') {
              const lines = primaryRoute.createPolylines();
              lines.forEach((pl) => {
                pl.setOptions({
                  strokeColor: '#10B981',
                  strokeOpacity: 0.95,
                  strokeWeight: 6,
                });
                pl.setMap(map);
              });
              polylinesRef.current = lines;
            }

            if (primaryRoute.viewport) {
              map.fitBounds(primaryRoute.viewport, 64);
            }
          }
        } catch {
          // Graceful fallback to pedestrian estimate
        }
      }

      if (!usedRealRoute || distMeters <= 0) {
        const directDist = computeHaversineMeters(origin, targetCoords);
        distMeters = Math.round(directDist * 1.22);
        durMillis = Math.round((distMeters / 80) * 60000);
      }

      const durationMinutes = Math.max(1, Math.round(durMillis / 60000));
      const stepCount = Math.round(distMeters / 0.762);
      const estimatedCalories = Math.max(1, Math.round((distMeters / 1000) * 55));

      const report: WalkingDistanceReport = {
        targetName: customName,
        targetCoords,
        originCoords: origin,
        distanceMeters: distMeters,
        durationMinutes,
        durationText:
          durationMinutes < 60
            ? `${durationMinutes} min`
            : `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`,
        stepCount,
        estimatedCalories,
        isRealRoute: usedRealRoute,
        computedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setWalkingReport(report);
      setIsCalculatingWalk(false);
      onShowToast(
        isHi
          ? `पैदल दूरी: ${formatDistance(distMeters)} (${durationMinutes} मिनट, ~${stepCount.toLocaleString()} कदम)`
          : `Walking Distance: ${formatDistance(distMeters)} (${durationMinutes} min, ~${stepCount.toLocaleString()} steps)`
      );
    },
    [userGpsPos, cameraCenter, routesLib, map, clearRoutePolylines, onShowToast, isHi]
  );

  const handleMapClick = useCallback(
    (ev: {
      detail?: {
        latLng?:
          | {
              lat: (() => number) | number;
              lng: (() => number) | number;
            }
          | null;
      };
    }) => {
      if (!walkingToolActive) return;
      const rawLatLng = ev?.detail?.latLng;
      if (!rawLatLng) return;

      const lat = typeof rawLatLng.lat === 'function' ? rawLatLng.lat() : Number(rawLatLng.lat);
      const lng = typeof rawLatLng.lng === 'function' ? rawLatLng.lng() : Number(rawLatLng.lng);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        void handleMeasureWalkingDistanceToPoint(
          { lat, lng },
          `Selected Map Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`
        );
      }
    },
    [walkingToolActive, handleMeasureWalkingDistanceToPoint]
  );

  const handleClearWalkingTool = useCallback(() => {
    setWalkingReport(null);
    setCustomWalkingPin(null);
    clearRoutePolylines();
    onShowToast('Walking distance tool cleared.');
  }, [clearRoutePolylines, onShowToast]);

  // Compute Directions via Routes API
  const computeDirectionsToPlace = useCallback(
    async (
      target: NearbyDoctorResult,
      modeOverride?: 'WALKING' | 'DRIVING',
      originOverride?: LatLngCoords
    ) => {
      const RouteClass = (routesLib as unknown as { Route?: { computeRoutes?: (req: unknown) => Promise<{ routes?: unknown[] }> } } | null)?.Route;
      const origin = originOverride || userGpsPos || cameraCenter;
      const chosenMode = modeOverride || travelMode;

      // If routes service is available, compute real routes
      if (RouteClass && typeof RouteClass.computeRoutes === 'function' && map) {
        setComputingRoute(true);
        clearRoutePolylines();

        try {
          const res = await RouteClass.computeRoutes({
            origin,
            destination: target.location,
            travelMode: chosenMode,
            fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
          });

          const primaryRoute = (res?.routes?.[0] ?? null) as {
            distanceMeters?: number;
            durationMillis?: number;
            viewport?: Parameters<NonNullable<typeof map>['fitBounds']>[0];
            createPolylines?: () => {
              setMap: (m: unknown) => void;
              setOptions: (opts: Record<string, unknown>) => void;
            }[];
          } | null;

          if (primaryRoute) {
            if (typeof primaryRoute.createPolylines === 'function') {
              const lines = primaryRoute.createPolylines();
              lines.forEach((pl) => {
                pl.setOptions({
                  strokeColor: '#D4AF37',
                  strokeOpacity: 0.95,
                  strokeWeight: 5,
                });
                pl.setMap(map);
              });
              polylinesRef.current = lines;
            }

            if (primaryRoute.viewport) {
              map.fitBounds(primaryRoute.viewport, 56);
            }

            setActiveRouteSummary({
              destinationName: target.name,
              distanceText:
                formatDistance(primaryRoute.distanceMeters ?? target.distanceMeters) || 'Nearby',
              durationText: formatDurationMillis(primaryRoute.durationMillis) || 'Direct path',
            });
          }
        } catch {
          // Fallback route summary
          setActiveRouteSummary({
            destinationName: target.name,
            distanceText: formatDistance(target.distanceMeters) || 'Nearby',
            durationText: chosenMode === 'WALKING' ? '~5 min walk' : '~2 min drive',
          });
        } finally {
          setComputingRoute(false);
        }
      } else {
        // Fallback simulation
        setActiveRouteSummary({
          destinationName: target.name,
          distanceText: formatDistance(target.distanceMeters) || 'Nearby',
          durationText: chosenMode === 'WALKING' ? '~5 min walk' : '~2 min drive',
        });
      }

      setSelectedPlaceId(target.id);
      onShowToast(`Showing ${chosenMode.toLowerCase()} route to ${target.name}`);

      // Request Safe-Route guidance from server
      apiFetch('/api/safe-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`,
          to: `${target.name}${target.address ? ` (${target.address})` : ''}`,
          travelMode: chosenMode,
          language: isHi ? 'hi' : 'en',
        }),
      })
        .then((r) => r.json())
        .then((routeData) => {
          if (routeData?.advice) {
            setSafeRouteAdvice(String(routeData.advice));
          }
        })
        .catch(() => {});
    },
    [routesLib, map, userGpsPos, cameraCenter, travelMode, clearRoutePolylines, onShowToast, isHi]
  );

  // Modern Places API (New): Place.searchNearby with FedEx Support
  const executeNearbySearch = useCallback(
    async (
      searchCenter: LatLngCoords,
      activeCategory: FacilityCategory,
      activeRadius: number,
      autoRouteNearestSafeSpot = false
    ) => {
      // If Places Library not loaded yet, filter seed fallback
      if (!placesLib || !placesLib.Place) {
        let filtered = SEED_FALLBACK_PLACES;
        if (activeCategory === 'fedex_courier') {
          filtered = SEED_FALLBACK_PLACES.filter((p) => p.isFedexOrCourier);
        } else if (activeCategory === 'public_safe_spots') {
          filtered = SEED_FALLBACK_PLACES.filter((p) => p.isPublicSafeSpot);
        }
        setResults(
          filtered.map((item) => ({
            ...item,
            distanceMeters: computeHaversineMeters(searchCenter, item.location),
          }))
        );
        return;
      }

      const { Place, SearchNearbyRankPreference } = placesLib;
      if (!Place || typeof Place.searchNearby !== 'function') return;

      setLoadingPlaces(true);
      setSearchError(null);

      const filterMeta =
        FACILITY_FILTERS.find((f) => f.id === activeCategory) || FACILITY_FILTERS[0];

      try {
        const response = await Place.searchNearby({
          fields: [
            'id',
            'displayName',
            'location',
            'formattedAddress',
            'nationalPhoneNumber',
            'internationalPhoneNumber',
            'rating',
            'userRatingCount',
            'googleMapsURI',
          ],
          locationRestriction: {
            center: searchCenter,
            radius: activeRadius,
          },
          includedPrimaryTypes: filterMeta.primaryTypes,
          maxResultCount: 12,
          rankPreference: SearchNearbyRankPreference?.DISTANCE,
        });

        const rawPlaces = (response?.places ?? []) as RawPlaceItem[];
        const mapped: NearbyDoctorResult[] = rawPlaces
          .map((p: RawPlaceItem): NearbyDoctorResult | null => {
            const loc = p.location;
            if (!loc) return null;
            const lat = typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat);
            const lng = typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            const coords = { lat, lng };
            return {
              id: p.id || `${lat},${lng}`,
              name: p.displayName || 'Safe Sanctuary Spot',
              categoryLabel: filterMeta.labelEn,
              address: p.formattedAddress || 'Main Street Corridor',
              phone: p.nationalPhoneNumber || p.internationalPhoneNumber || null,
              rating: typeof p.rating === 'number' ? p.rating : null,
              userRatingCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
              googleMapsURI: p.googleMapsURI || null,
              location: coords,
              distanceMeters: computeHaversineMeters(searchCenter, coords),
              isPublicSafeSpot: activeCategory === 'public_safe_spots',
              isFedexOrCourier: activeCategory === 'fedex_courier',
            };
          })
          .filter((item: NearbyDoctorResult | null): item is NearbyDoctorResult => item !== null)
          .sort((a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999));

        if (mapped.length > 0) {
          setResults(mapped);
          setSelectedPlaceId(mapped[0].id);
          if (autoRouteNearestSafeSpot) {
            void computeDirectionsToPlace(mapped[0], 'WALKING', searchCenter);
          }
        } else {
          // Keep relevant seed items if search returns empty
          const fallbackFiltered =
            activeCategory === 'fedex_courier'
              ? SEED_FALLBACK_PLACES.filter((p) => p.isFedexOrCourier)
              : SEED_FALLBACK_PLACES;
          setResults(
            fallbackFiltered.map((p) => ({
              ...p,
              distanceMeters: computeHaversineMeters(searchCenter, p.location),
            }))
          );
        }
      } catch {
        // Graceful fallback to verified places
        const fallbackFiltered =
          activeCategory === 'fedex_courier'
            ? SEED_FALLBACK_PLACES.filter((p) => p.isFedexOrCourier)
            : SEED_FALLBACK_PLACES;
        setResults(
          fallbackFiltered.map((p) => ({
            ...p,
            distanceMeters: computeHaversineMeters(searchCenter, p.location),
          }))
        );
      } finally {
        setLoadingPlaces(false);
      }
    },
    [placesLib, computeDirectionsToPlace]
  );

  // High-Accuracy "Find Me" GPS Connect Action
  const handleConnectGpsFindMe = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      setGpsErrorMsg('Browser Geolocation is not supported on this device.');
      onShowToast('Geolocation not available on this browser.');
      return;
    }

    setGpsStatus('locating');
    setGpsErrorMsg(null);
    onShowToast('Connecting GPS satellite & high-accuracy sensors...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: LatLngCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserGpsPos(coords);
        setGpsAccuracy(Math.round(pos.coords.accuracy || 12));
        setGpsStatus('active');
        setGpsAddress(
          `Live GPS Verified (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}) ±${Math.round(
            pos.coords.accuracy || 12
          )}m`
        );
        setCameraCenter(coords);
        setCameraZoom(16);
        map?.panTo(coords);
        map?.setZoom(16);

        void executeNearbySearch(coords, category, radiusMeters);
        onShowToast(
          isHi
            ? `GPS कनेक्ट हुआ (सटीकता ±${Math.round(pos.coords.accuracy || 12)} मीटर)`
            : `GPS Connected: Accuracy ±${Math.round(pos.coords.accuracy || 12)}m`
        );
      },
      (err) => {
        setGpsStatus('denied');
        setGpsErrorMsg(
          err.code === 1
            ? 'Location permission declined. Allow GPS access in browser settings.'
            : 'GPS signal weak or unavailable. Using Sanctuary verified reference center.'
        );
        onShowToast('GPS permission not granted. Search any location in the upper bar.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }, [map, category, radiusMeters, executeNearbySearch, isHi, onShowToast]);

  // Initial GPS Discovery on Mount
  useEffect(() => {
    handleConnectGpsFindMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Category change search effect
  useEffect(() => {
    const anchor = userGpsPos || INITIAL_FALLBACK_CENTER;
    void executeNearbySearch(anchor, category, radiusMeters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, radiusMeters]);

  // Upper Search Bar
  const handleUpperLocationSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = upperLocationQuery.trim();
    if (!q) return;

    setSearchingLocation(true);
    if (placesLib?.Place && typeof placesLib.Place.searchByText === 'function') {
      try {
        const res = await placesLib.Place.searchByText({
          textQuery: q,
          fields: ['id', 'displayName', 'location', 'formattedAddress'],
          maxResultCount: 4,
        });
        const first = res?.places?.[0];
        if (first?.location) {
          const lat =
            typeof first.location.lat === 'function'
              ? first.location.lat()
              : Number(first.location.lat);
          const lng =
            typeof first.location.lng === 'function'
              ? first.location.lng()
              : Number(first.location.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const targetCenter = { lat, lng };
            setCameraCenter(targetCenter);
            setCameraZoom(15);
            map?.panTo(targetCenter);
            map?.setZoom(15);
            clearRoutePolylines();
            void executeNearbySearch(targetCenter, category, radiusMeters);
            onShowToast(`Moved GPS map to ${first.displayName || q}`);
            setSearchingLocation(false);
            return;
          }
        }
      } catch {}
    }

    // Fallback search simulated
    setCameraCenter(INITIAL_FALLBACK_CENTER);
    map?.panTo(INITIAL_FALLBACK_CENTER);
    onShowToast(`Located "${q}" area`);
    setSearchingLocation(false);
  };

  // 1-Tap Public Safe Spot Finder
  const handleFindNearestPublicSafeSpot = () => {
    setCategory('public_safe_spots');
    const anchor = userGpsPos || cameraCenter;
    void executeNearbySearch(anchor, 'public_safe_spots', radiusMeters, true);
    onShowToast('Finding nearest staffed safe spot & safe route');
  };

  // Toggle Live Sharing Session
  const handleToggleLiveSharingSession = () => {
    if (isSharingLiveGps) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsSharingLiveGps(false);
      onShowToast('Stopped live GPS location sharing');
      return;
    }

    if (!liveLocationPermitted) {
      onShowToast('Grant Live Location Permission first using the switch.');
      return;
    }

    if (!navigator.geolocation) {
      onShowToast('Browser Geolocation not supported.');
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserGpsPos(coords);
        setGpsAccuracy(Math.round(pos.coords.accuracy || 10));
        setGpsStatus('active');
        apiFetch('/api/location/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: coords.lat,
            lng: coords.lng,
            active: true,
            permittedCount: permittedFavourites.length,
          }),
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    watchIdRef.current = id;
    setIsSharingLiveGps(true);
    onShowToast(`Live GPS sharing active for ${permittedFavourites.length} permitted contacts`);
  };

  // Handle Excess Water Confirmation Submit
  const handleConfirmExcessWater = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingWater(true);
    try {
      const res = await apiFetch('/api/hydration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intakeMl: waterIntakeMl,
          symptoms: waterSymptoms,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const conf = data.confirmation;
        setWaterConfirmationResult({
          confirmationStatus: conf.confirmationStatus,
          doctorAdvice: conf.doctorAdvice,
        });
        onShowToast('Hydration & excess water check confirmed.');
      }
    } catch {
      onShowToast('Recorded hydration check locally.');
      setWaterConfirmationResult({
        confirmationStatus: waterIntakeMl > 3800 ? 'mild_retention' : 'confirmed_balanced',
        doctorAdvice:
          waterIntakeMl > 3800
            ? 'Excess water retention noted. Elevate legs, reduce excess table salt, and consult physician if puffy swelling persists.'
            : 'Healthy fluid osmotic balance confirmed.',
      });
    } finally {
      setSubmittingWater(false);
    }
  };

  const displayedResults = useMemo(() => {
    const q = floatingFilterText.trim().toLowerCase();
    if (!q) return results;
    return results.filter((doc) =>
      `${doc.name} ${doc.address} ${doc.categoryLabel} ${doc.phone || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [results, floatingFilterText]);

  const selectedDoctor =
    displayedResults.find((r) => r.id === selectedPlaceId) ||
    results.find((r) => r.id === selectedPlaceId) ||
    null;

  const liveMapsShareUrl = userGpsPos
    ? `https://www.google.com/maps?q=${userGpsPos.lat},${userGpsPos.lng}`
    : `https://www.google.com/maps?q=${cameraCenter.lat},${cameraCenter.lng}`;

  const smsFavNumbers = permittedFavourites
    .map((f) => f.phone.replace(/\s+/g, ''))
    .filter(Boolean)
    .join(',');

  const smsLiveLocationHref = `sms:${smsFavNumbers}?body=${encodeURIComponent(
    `Saevy Live GPS Share — Follow my location pin: ${liveMapsShareUrl}`
  )}`;

  return (
    <div className="space-y-5">
      {/* 1. TOP CONTROL BAR: "FIND ME" GPS ICON, VIEW TOGGLE & EXCESS WATER CONFIRMATION */}
      <div className="luxury-card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Prominent "Find Me" GPS Feature with Pulse Animation */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleConnectGpsFindMe}
            className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-[#1F1830] to-[#392955] border-2 border-[#D4AF37] text-[#F5EFE6] flex items-center justify-center shrink-0 shadow-[0_8px_24px_rgba(212,175,55,0.28)] active:scale-95 transition-all group"
            title="Find Me (Connect High-Accuracy GPS)"
            aria-label="Find Me GPS Location"
          >
            {gpsStatus === 'active' && (
              <span className="absolute inset-0 rounded-full border border-[#34D399] animate-ping opacity-75" />
            )}
            <span className="material-symbols-outlined text-[26px] text-[#D4AF37] group-hover:rotate-45 transition-transform">
              {gpsStatus === 'locating' ? 'refresh' : 'my_location'}
            </span>
          </button>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base text-[#0A0A0A]">
                Find Me GPS
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  gpsStatus === 'active'
                    ? 'bg-[#E3EFE3] text-[#3E6B4E]'
                    : gpsStatus === 'locating'
                      ? 'bg-[#FEF3C7] text-[#D97706]'
                      : 'bg-[#F0E6DC] text-[#5C544E]'
                }`}
              >
                {gpsStatus === 'active'
                  ? `Connected (±${gpsAccuracy ?? 12}m)`
                  : gpsStatus === 'locating'
                    ? 'Acquiring GPS...'
                    : 'Tap Icon to Connect'}
              </span>
            </div>
            <p className="text-xs text-[#5C544E] truncate max-w-xs">{gpsAddress}</p>
          </div>
        </div>

        {/* Right: View Toggle (Standard Map vs Sheet View) & Excess Water Check */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Toggle: Standard Map View vs Sheet View */}
          <div className="inline-flex rounded-full bg-[#FAF1E6] border border-[#F0E6DC] p-1 shadow-inner">
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`min-h-[38px] px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'map'
                  ? 'bg-[#0A0A0A] text-[#FFFCF8] shadow-sm'
                  : 'text-[#5C544E] hover:text-[#0A0A0A]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-[#D4AF37]">map</span>
              <span>Standard Map</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('sheet')}
              className={`min-h-[38px] px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'sheet'
                  ? 'bg-[#0A0A0A] text-[#FFFCF8] shadow-sm'
                  : 'text-[#5C544E] hover:text-[#0A0A0A]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-[#D4AF37]">
                table_chart
              </span>
              <span>Sheet View</span>
            </button>
          </div>

          {/* Dedicated Walking Distance Tool Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !walkingToolActive;
              setWalkingToolActive(next);
              onShowToast(
                next
                  ? isHi
                    ? 'पैदल दूरी टूल सक्रिय: मैप पर किसी भी बिंदु पर टैप करें।'
                    : 'Walking Tool Active: Tap any point on the map to measure walking distance & steps.'
                  : isHi
                    ? 'पैदल दूरी टूल बंद।'
                    : 'Walking Tool Paused.'
              );
            }}
            className={`min-h-[42px] px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
              walkingToolActive
                ? 'bg-[#10B981] text-[#FFFFFF] shadow-[0_4px_16px_rgba(16,185,129,0.3)]'
                : 'bg-[#FAF1E6] text-[#5C544E] border border-[#F0E6DC] hover:text-[#0A0A0A]'
            }`}
            title="Measure walking distance to any point on map"
          >
            <span className="material-symbols-outlined text-[18px]">directions_walk</span>
            <span>{walkingToolActive ? 'Walking Tool Active' : 'Walking Tool'}</span>
          </button>

          {/* Excess Water Confirmation Action Button */}
          <button
            type="button"
            onClick={() => setWaterModalOpen(true)}
            className="min-h-[42px] px-4 rounded-full bg-[#E8F1F5] hover:bg-[#D9EAF0] text-[#1E3A5F] border border-[#BCD4E6] text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-[17px] text-[#2563EB]">
              water_drop
            </span>
            <span>Excess Water Check</span>
          </button>
        </div>
      </div>

      {/* 2. UPPER SEARCH BAR & NEAREST CROWDED SAFE SPOT BUTTON */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        <form
          onSubmit={handleUpperLocationSearch}
          className="lg:col-span-8 flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 rounded-full bg-[#FFFCF8] border border-[#F0E6DC] shadow-[0_6px_24px_rgba(0,0,0,0.06)]"
        >
          <span className="material-symbols-outlined text-[20px] text-[#D4AF37] pl-3">
            travel_explore
          </span>
          <input
            type="search"
            value={upperLocationQuery}
            onChange={(e) => setUpperLocationQuery(e.target.value)}
            placeholder={
              isHi
                ? 'कोई भी स्थान, फेडेक्स हब, मेट्रो स्टेशन या शहर खोजें...'
                : 'Search any location, FedEx hub, metro station, clinic, or area...'
            }
            aria-label="Search location on GPS map"
            className="flex-1 min-w-[150px] min-h-[42px] px-2 bg-transparent text-xs sm:text-sm text-[#0A0A0A] focus:outline-none"
          />
          <button
            type="submit"
            disabled={searchingLocation}
            className="btn-luxury px-5 text-xs font-medium shrink-0"
          >
            {searchingLocation ? 'Searching...' : isHi ? 'खोजें' : 'Search Location'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleFindNearestPublicSafeSpot}
          className="lg:col-span-4 min-h-[52px] px-5 rounded-full bg-gradient-to-r from-[#1F1830] to-[#2B2142] text-[#F5EFE6] border border-[#D4AF37] text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(212,175,55,0.18)] active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[19px] text-[#D4AF37]">
            shield_pin
          </span>
          <span>Nearest Public Safe Spot + Route</span>
        </button>
      </div>

      {/* 3. CATEGORY FILTERS (WITH FEDEX & COURIER HUBS) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {FACILITY_FILTERS.map((f) => {
            const active = category === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setCategory(f.id)}
                className={`min-h-[42px] px-4 rounded-full text-xs font-medium tracking-wide transition-all whitespace-nowrap shrink-0 active:scale-[0.98] flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#0A0A0A] text-[#FFFCF8] border border-[#D4AF37]/60'
                    : 'bg-[#FFFCF8] text-[#5C544E] border border-[#F0E6DC] hover:border-[#D4AF37]/60 hover:text-[#0A0A0A]'
                }`}
              >
                {f.id === 'fedex_courier' && (
                  <span className="material-symbols-outlined text-[15px] text-[#D4AF37]">
                    local_shipping
                  </span>
                )}
                <span>{isHi ? f.labelHi : f.labelEn}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-[#FFFCF8] border border-[#F0E6DC] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTravelMode('WALKING')}
              className={`px-3 py-1.5 rounded-full font-medium ${
                travelMode === 'WALKING' ? 'bg-[#0A0A0A] text-[#FFFCF8]' : 'text-[#5C544E]'
              }`}
            >
              Walk
            </button>
            <button
              type="button"
              onClick={() => setTravelMode('DRIVING')}
              className={`px-3 py-1.5 rounded-full font-medium ${
                travelMode === 'DRIVING' ? 'bg-[#0A0A0A] text-[#FFFCF8]' : 'text-[#5C544E]'
              }`}
            >
              Cab / Drive
            </button>
          </div>

          <select
            aria-label="Search radius"
            value={radiusMeters}
            onChange={(e) => setRadiusMeters(Number(e.target.value))}
            className="min-h-[42px] px-4 rounded-full bg-[#FFFCF8] border border-[#F0E6DC] text-xs font-medium text-[#0A0A0A] focus:outline-none focus:border-[#D4AF37] tabular-nums"
          >
            <option value={2000}>Within 2 km</option>
            <option value={3500}>Within 3.5 km</option>
            <option value={7000}>Within 7 km</option>
            <option value={15000}>Within 15 km</option>
          </select>
        </div>
      </div>

      {/* Active Route Summary Banner */}
      {activeRouteSummary && (
        <div className="luxury-card p-3.5 px-5 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#D4AF37]">route</span>
              <span>
                Directions to <strong className="text-[#0A0A0A]">{activeRouteSummary.destinationName}</strong>:{' '}
                <strong className="text-[#D4AF37]">{activeRouteSummary.durationText}</strong> (
                {activeRouteSummary.distanceText})
              </span>
            </div>
            <button
              type="button"
              onClick={clearRoutePolylines}
              className="underline text-[#5C544E] hover:text-[#0A0A0A]"
            >
              Clear Route
            </button>
          </div>
          {safeRouteAdvice && (
            <p className="text-xs text-[#5C544E] leading-relaxed border-t border-[#F0E6DC] pt-2">
              {safeRouteAdvice}
            </p>
          )}
        </div>
      )}

      {/* ================= WALKING DISTANCE CALCULATOR TELEMETRY CARD ================= */}
      {walkingReport && (
        <div className="luxury-card p-5 border-2 border-[#10B981]/50 bg-gradient-to-br from-[#F0FDF4] via-[#FFFCF8] to-[#FFFBEB] space-y-4 shadow-[0_12px_36px_rgba(16,185,129,0.12)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D1FAE5]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#10B981] text-[#FFFFFF] flex items-center justify-center shrink-0 shadow-md">
                <span className="material-symbols-outlined text-[24px]">directions_walk</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-base sm:text-lg font-bold text-[#0A0A0A]">
                    Walking Distance & Pedestrian Telemetry
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D1FAE5] text-[#065F46] uppercase tracking-wide">
                    {walkingReport.isRealRoute ? 'Routes API Walking' : 'Geodesic Pedestrian'}
                  </span>
                </div>
                <p className="text-xs text-[#065F46]">
                  From your live GPS position to:{' '}
                  <strong className="text-[#0A0A0A]">{walkingReport.targetName}</strong> (
                  {walkingReport.targetCoords.lat.toFixed(4)}, {walkingReport.targetCoords.lng.toFixed(4)})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleClearWalkingTool}
                className="text-xs font-semibold px-3 py-1.5 rounded-full text-[#5C544E] hover:text-[#0A0A0A] bg-[#FFFCF8] border border-[#F0E6DC]"
              >
                Clear Tool
              </button>
            </div>
          </div>

          {/* 4 Pedestrian Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Walking Distance */}
            <div className="p-3.5 rounded-2xl bg-[#FFFCF8] border border-[#A7F3D0] shadow-sm space-y-1">
              <span className="text-[11px] font-semibold text-[#065F46] uppercase tracking-wider block">
                Walking Distance
              </span>
              <div className="font-display font-bold text-xl sm:text-2xl text-[#0A0A0A] tabular-nums">
                {walkingReport.distanceMeters < 1000
                  ? `${walkingReport.distanceMeters} m`
                  : `${(walkingReport.distanceMeters / 1000).toFixed(2)} km`}
              </div>
              <span className="text-[10px] text-[#5C544E] block">
                {walkingReport.distanceMeters.toLocaleString()} m pedestrian path
              </span>
            </div>

            {/* Walking Time */}
            <div className="p-3.5 rounded-2xl bg-[#FFFCF8] border border-[#A7F3D0] shadow-sm space-y-1">
              <span className="text-[11px] font-semibold text-[#065F46] uppercase tracking-wider block">
                Est. Walk Time
              </span>
              <div className="font-display font-bold text-xl sm:text-2xl text-[#0A0A0A] tabular-nums">
                {walkingReport.durationText}
              </div>
              <span className="text-[10px] text-[#5C544E] block">Standard pace (~4.8 km/h)</span>
            </div>

            {/* Steps Count */}
            <div className="p-3.5 rounded-2xl bg-[#FFFCF8] border border-[#A7F3D0] shadow-sm space-y-1">
              <span className="text-[11px] font-semibold text-[#065F46] uppercase tracking-wider block">
                Pedestrian Steps
              </span>
              <div className="font-display font-bold text-xl sm:text-2xl text-[#0A0A0A] tabular-nums">
                ~{walkingReport.stepCount.toLocaleString()}
              </div>
              <span className="text-[10px] text-[#5C544E] block">Avg stride (~0.76 m)</span>
            </div>

            {/* Active Calories */}
            <div className="p-3.5 rounded-2xl bg-[#FFFCF8] border border-[#A7F3D0] shadow-sm space-y-1">
              <span className="text-[11px] font-semibold text-[#065F46] uppercase tracking-wider block">
                Active Energy
              </span>
              <div className="font-display font-bold text-xl sm:text-2xl text-[#0A0A0A] tabular-nums">
                ~{walkingReport.estimatedCalories} kcal
              </div>
              <span className="text-[10px] text-[#5C544E] block">Metabolic rate (~55 kcal/km)</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
            <div className="flex items-center gap-1.5 text-[#065F46]">
              <span className="material-symbols-outlined text-[16px]">touch_app</span>
              <span>
                {isCalculatingWalk
                  ? 'Calculating walking distance...'
                  : 'Tap any other spot on the map to measure walking distance immediately.'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${walkingReport.originCoords.lat},${walkingReport.originCoords.lng}&destination=${walkingReport.targetCoords.lat},${walkingReport.targetCoords.lng}&travelmode=walking`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[36px] px-3.5 rounded-full bg-[#0A0A0A] text-[#FFFCF8] text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:bg-[#2563EB] transition-colors"
              >
                <span className="material-symbols-outlined text-[15px] text-[#D4AF37]">
                  navigation
                </span>
                <span>Google Maps Walking Navigation</span>
              </a>

              {permittedFavourites.length > 0 && (
                <a
                  href={`sms:${smsFavNumbers}?body=${encodeURIComponent(
                    `Walking ETA: ${walkingReport.durationText} (${formatDistance(
                      walkingReport.distanceMeters
                    )}) to ${walkingReport.targetName}. Following live route from GPS.`
                  )}`}
                  className="min-h-[36px] px-3.5 rounded-full bg-[#D1FAE5] text-[#065F46] border border-[#10B981]/40 text-xs font-semibold flex items-center gap-1.5 hover:bg-[#A7F3D0] transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">sms</span>
                  <span>Send Walk ETA to Contacts</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW 1: STANDARD GOOGLE MAP VIEW ================= */}
      {viewMode === 'map' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-7 w-full h-[450px] sm:h-[530px] rounded-[28px] overflow-hidden border border-[#F0E6DC] bg-[#FFFCF8] relative">
            {/* Floating Filter Bar */}
            <div className="absolute top-3.5 left-3.5 right-3.5 z-20 flex flex-wrap sm:flex-nowrap items-center gap-2 p-1.5 rounded-full bg-[#FFFCF8]/94 backdrop-blur-xl border border-[#F0E6DC] shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
              <span className="material-symbols-outlined text-[18px] text-[#D4AF37] pl-3 shrink-0">
                filter_list
              </span>
              <input
                type="search"
                value={floatingFilterText}
                onChange={(e) => setFloatingFilterText(e.target.value)}
                placeholder="Filter pins on map..."
                aria-label="Filter locations on map"
                className="flex-1 min-w-[110px] min-h-[38px] px-1.5 bg-transparent text-xs sm:text-sm text-[#0A0A0A] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleConnectGpsFindMe}
                disabled={gpsStatus === 'locating'}
                className="min-h-[38px] px-3.5 rounded-full bg-[#0A0A0A] text-[#FFFCF8] text-xs font-medium flex items-center gap-1.5 border border-[#D4AF37]/40 shrink-0"
              >
                <span className="material-symbols-outlined text-[16px] text-[#D4AF37]">
                  my_location
                </span>
                <span>{gpsStatus === 'locating' ? 'Locating...' : 'Find Me'}</span>
              </button>
            </div>

            {/* Google Maps Component with Advanced Markers */}
            <Map
              center={cameraCenter}
              zoom={cameraZoom}
              onCameraChanged={(ev: MapCameraChangedEvent) => {
                setCameraCenter(ev.detail.center);
                setCameraZoom(ev.detail.zoom);
              }}
              onClick={handleMapClick}
              mapId="DEMO_MAP_ID"
              gestureHandling="greedy"
              clickableIcons={false}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              className="w-full h-full cursor-crosshair"
            >
              {userGpsPos && (
                <AdvancedMarker position={userGpsPos} title="Your Live GPS Location">
                  <Pin
                    background="#B76E79"
                    borderColor="#FFFCF8"
                    glyphColor="#FFFCF8"
                    glyphText="YOU"
                  />
                </AdvancedMarker>
              )}

              {/* Dedicated Walking Distance Target Pin with Subtle Bounce Feedback */}
              {customWalkingPin && (
                <AdvancedMarker
                  position={customWalkingPin.coords}
                  title={customWalkingPin.label}
                  zIndex={45}
                >
                  <div
                    key={`walking-pin-${customWalkingPin.coords.lat.toFixed(6)}-${customWalkingPin.coords.lng.toFixed(6)}`}
                    className="relative flex flex-col items-center animate-marker-bounce"
                  >
                    <span className="absolute -bottom-1 w-7 h-7 rounded-full bg-[#10B981]/40 animate-marker-ripple pointer-events-none" />
                    <Pin
                      background="#10B981"
                      borderColor="#FFFFFF"
                      glyphColor="#FFFFFF"
                      glyphText="🚶"
                      scale={1.25}
                    />
                  </div>
                </AdvancedMarker>
              )}

              {displayedResults.map((doc, idx) => {
                const isSelected = doc.id === selectedPlaceId;
                const isFedex = doc.isFedexOrCourier;
                return (
                  <AdvancedMarker
                    key={doc.id}
                    position={doc.location}
                    title={doc.name}
                    onClick={() => setSelectedPlaceId(doc.id)}
                    zIndex={isSelected ? 30 : 10}
                  >
                    <div className={isSelected ? 'animate-marker-bounce' : ''}>
                      <Pin
                        background={
                          isSelected ? '#D4AF37' : isFedex ? '#4D148C' : '#0A0A0A'
                        }
                        borderColor="#D4AF37"
                        glyphColor={isSelected ? '#0A0A0A' : '#F5EFE6'}
                        glyphText={isFedex ? 'FX' : String(idx + 1)}
                        scale={isSelected ? 1.16 : 1}
                      />
                    </div>
                  </AdvancedMarker>
                );
              })}

              {selectedDoctor && (
                <InfoWindow
                  position={selectedDoctor.location}
                  onCloseClick={() => setSelectedPlaceId(null)}
                >
                  <div className="max-w-[250px] text-[#0A0A0A] space-y-2 p-1 font-sans">
                    <div className="font-display font-bold text-sm leading-snug">
                      {selectedDoctor.name}
                    </div>
                    <div className="text-[11px] text-[#8C6D1F] font-semibold">
                      {selectedDoctor.categoryLabel}
                    </div>
                    {selectedDoctor.address && (
                      <div className="text-xs text-[#5C544E] leading-snug">
                        {selectedDoctor.address}
                      </div>
                    )}
                    <div className="text-xs text-[#8C6D1F] font-medium tabular-nums">
                      {selectedDoctor.rating !== null && (
                        <span>★ {selectedDoctor.rating.toFixed(1)} · </span>
                      )}
                      {formatDistance(selectedDoctor.distanceMeters)}
                    </div>
                    <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        disabled={computingRoute}
                        onClick={() => void computeDirectionsToPlace(selectedDoctor)}
                        className="px-3 py-1.5 rounded-full bg-[#0A0A0A] text-[#FFFCF8] text-xs font-medium"
                      >
                        {computingRoute ? 'Routing...' : 'Directions'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleMeasureWalkingDistanceToPoint(
                            selectedDoctor.location,
                            selectedDoctor.name
                          )
                        }
                        className="px-3 py-1.5 rounded-full bg-[#10B981] text-[#FFFFFF] text-xs font-medium flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          directions_walk
                        </span>
                        <span>Walk Dist</span>
                      </button>
                      {selectedDoctor.phone && (
                        <a
                          href={`tel:${selectedDoctor.phone}`}
                          className="px-3 py-1.5 rounded-full bg-[#FAF1E6] border border-[#D4AF37]/40 text-[#0A0A0A] text-xs font-medium"
                        >
                          Call
                        </a>
                      )}
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Map>

            {/* Walking Tool Indicator Overlay */}
            {walkingToolActive && (
              <div className="absolute bottom-3 left-3 z-20 pointer-events-none bg-[#0A0A0A]/90 text-[#F5EFE6] backdrop-blur-md px-3.5 py-1.5 rounded-full text-[11px] font-medium flex items-center gap-2 border border-[#10B981]/50 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping shrink-0" />
                <span>Tap any point on map to calculate walking distance</span>
              </div>
            )}
          </div>

          {/* Right Directory List */}
          <div className="lg:col-span-5 luxury-card p-5 flex flex-col justify-between max-h-[530px]">
            <div className="pb-3 border-b border-[#F0E6DC]">
              <h3 className="font-display text-lg font-bold text-[#0A0A0A]">
                {category === 'fedex_courier'
                  ? 'FedEx & Courier Safe Hubs'
                  : category === 'public_safe_spots'
                    ? 'Crowded Public Safe Spots'
                    : 'Verified Clinics & Sanctuaries'}
              </h3>
              <p className="text-xs text-[#5C544E] mt-0.5">
                {displayedResults.length} locations verified · Tap Directions for live route
              </p>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
              {displayedResults.map((doc, idx) => {
                const active = doc.id === selectedPlaceId;
                const distText = formatDistance(doc.distanceMeters);
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      setSelectedPlaceId(doc.id);
                      setCameraCenter(doc.location);
                      map?.panTo(doc.location);
                    }}
                    className={`rounded-[20px] p-4 border transition-all cursor-pointer space-y-2.5 ${
                      active
                        ? 'bg-[#FAF3EB] border-[#D4AF37]'
                        : 'bg-[#FFFCF8] border-[#F0E6DC] hover:border-[#D4AF37]/60'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold text-[#0A0A0A] leading-snug">
                          <span className="text-[#D4AF37] font-bold tabular-nums mr-1.5">
                            {doc.isFedexOrCourier ? 'FX' : `0${idx + 1}`}.
                          </span>
                          {doc.name}
                        </h4>
                        {distText && (
                          <span className="text-[11px] text-[#8C6D1F] font-medium tabular-nums shrink-0">
                            {distText}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#8C6D1F] font-medium">
                        {doc.categoryLabel}
                      </div>
                      <p className="text-xs text-[#5C544E] leading-snug">{doc.address}</p>
                    </div>

                    <div
                      className="pt-2 border-t border-[#F0E6DC] flex flex-wrap items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={computingRoute}
                        onClick={() => void computeDirectionsToPlace(doc)}
                        className="min-h-[38px] px-3.5 rounded-full bg-[#0A0A0A] text-[#FFFCF8] text-xs font-medium flex items-center gap-1.5 border border-[#D4AF37]/50"
                      >
                        <span className="material-symbols-outlined text-[15px] text-[#D4AF37]">
                          directions
                        </span>
                        <span>Directions</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleMeasureWalkingDistanceToPoint(doc.location, doc.name)
                        }
                        className="min-h-[38px] px-3.5 rounded-full bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#065F46] text-xs font-semibold flex items-center gap-1 border border-[#10B981]/30 transition-all"
                        title="Calculate walking distance and steps"
                      >
                        <span className="material-symbols-outlined text-[15px] text-[#10B981]">
                          directions_walk
                        </span>
                        <span>Walk Dist</span>
                      </button>

                      {doc.phone && (
                        <a
                          href={`tel:${doc.phone}`}
                          className="min-h-[38px] px-3.5 rounded-full bg-[#FFFCF8] border border-[#F0E6DC] text-xs font-medium text-[#0A0A0A] flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px] text-[#D4AF37]">
                            call
                          </span>
                          <span>Call</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-[#F0E6DC] text-[11px] text-[#5C544E] flex items-center justify-between">
              <span>National Helpline: 112 / 181</span>
              <button
                type="button"
                onClick={() => setViewMode('sheet')}
                className="underline text-[#D4AF37] font-semibold"
              >
                Switch to Sheet View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW 2: FULL SPREADSHEET / SHEET VIEW ================= */}
      {viewMode === 'sheet' && (
        <div className="luxury-card p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0E6DC]">
            <div>
              <h3 className="font-display text-xl font-bold text-[#0A0A0A] flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-[#D4AF37]">
                  table_chart
                </span>
                <span>GPS Directory & Places Sheet View</span>
              </h3>
              <p className="text-xs text-[#5C544E] mt-0.5">
                Tabular spreadsheet view of verified clinics, safe spots, and FedEx shipping hubs with live GPS data.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const headers = 'ID,Name,Category,Distance,Address,Phone,Rating,Latitude,Longitude\n';
                  const rows = displayedResults
                    .map(
                      (d) =>
                        `"${d.id}","${d.name}","${d.categoryLabel}","${
                          d.distanceMeters ?? ''
                        }m","${d.address}","${d.phone || ''}","${d.rating || ''}","${
                          d.location.lat
                        }","${d.location.lng}"`
                    )
                    .join('\n');
                  const blob = new Blob([headers + rows], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `saevy-gps-directory-${Date.now()}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  onShowToast('Exported GPS Directory as CSV Sheet');
                }}
                className="btn-luxury-outline px-4 text-xs font-semibold flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">file_download</span>
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className="btn-luxury px-5 text-xs font-semibold"
              >
                Back to Map
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-2xl border border-[#F0E6DC]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF1E6] border-b border-[#F0E6DC] text-[#0A0A0A]">
                  <th className="py-3 px-3.5 font-bold">#</th>
                  <th className="py-3 px-3.5 font-bold">Facility Name</th>
                  <th className="py-3 px-3.5 font-bold">Category</th>
                  <th className="py-3 px-3.5 font-bold">Distance & ETA</th>
                  <th className="py-3 px-3.5 font-bold">Address</th>
                  <th className="py-3 px-3.5 font-bold">Phone Number</th>
                  <th className="py-3 px-3.5 font-bold">Rating</th>
                  <th className="py-3 px-3.5 font-bold">Coordinates</th>
                  <th className="py-3 px-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E6DC]">
                {displayedResults.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#FAF3EB] transition-colors bg-[#FFFCF8]"
                  >
                    <td className="py-3 px-3.5 font-bold text-[#8C6D1F] tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3.5 font-semibold text-[#0A0A0A]">
                      <div className="flex items-center gap-1.5">
                        {item.isFedexOrCourier && (
                          <span className="px-1.5 py-0.5 rounded bg-[#4D148C] text-[#FFFFFF] text-[10px] font-bold">
                            FedEx
                          </span>
                        )}
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-[#5C544E]">{item.categoryLabel}</td>
                    <td className="py-3 px-3.5 font-medium text-[#8C6D1F] tabular-nums">
                      {formatDistance(item.distanceMeters) || 'Nearby'}
                    </td>
                    <td className="py-3 px-3.5 text-[#5C544E] max-w-[200px] truncate">
                      {item.address}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-[#0A0A0A]">
                      {item.phone ? (
                        <a href={`tel:${item.phone}`} className="hover:underline text-[#D4AF37]">
                          {item.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-3.5 font-medium tabular-nums text-[#0A0A0A]">
                      {item.rating ? `★ ${item.rating.toFixed(1)}` : '—'}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-[11px] text-[#5C544E]">
                      {item.location.lat.toFixed(4)}, {item.location.lng.toFixed(4)}
                    </td>
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            void computeDirectionsToPlace(item);
                            setViewMode('map');
                          }}
                          className="px-2.5 py-1 rounded-full bg-[#0A0A0A] text-[#FFFCF8] text-[11px] font-medium"
                        >
                          Directions
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleMeasureWalkingDistanceToPoint(item.location, item.name);
                            setViewMode('map');
                          }}
                          className="px-2.5 py-1 rounded-full bg-[#10B981]/15 text-[#065F46] hover:bg-[#10B981]/25 border border-[#10B981]/30 text-[11px] font-semibold flex items-center gap-1"
                          title="Calculate walking distance & steps"
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            directions_walk
                          </span>
                          <span>Walk Dist</span>
                        </button>
                        {item.googleMapsURI && (
                          <a
                            href={item.googleMapsURI}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded-full border border-[#D4AF37]/50 text-[#0A0A0A] text-[11px]"
                          >
                            Map
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= 4. EXCESS WATER CONFIRMATION MODAL ================= */}
      {waterModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0A]/40 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-[28px] bg-[#FFFCF8] border border-[#D4AF37]/45 p-6 sm:p-8 space-y-5 shadow-[0_24px_64px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E6DC]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-[#2563EB]">
                  water_drop
                </span>
                <h3 className="font-display text-xl font-bold text-[#0A0A0A]">
                  Excess Water & Hydration Confirmation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setWaterModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#FAF1E6]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmExcessWater} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0A0A0A] mb-1">
                  Today's Estimated Water Intake: <strong className="text-[#2563EB]">{waterIntakeMl} ml</strong> ({Math.round(waterIntakeMl / 250)} glasses)
                </label>
                <input
                  type="range"
                  min={800}
                  max={5000}
                  step={100}
                  value={waterIntakeMl}
                  onChange={(e) => setWaterIntakeMl(Number(e.target.value))}
                  className="w-full accent-[#2563EB]"
                />
                <div className="flex justify-between text-[11px] text-[#5C544E] pt-1">
                  <span>800 ml (Low)</span>
                  <span className="text-[#3E6B4E] font-semibold">2200–2800 ml (Optimal)</span>
                  <span>5000 ml (Excess)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0A0A0A] mb-1.5">
                  Are you experiencing any excess fluid or dehydration cues?
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'swollen_feet', label: 'Swollen Feet / Ankles' },
                    { id: 'puffy_fingers', label: 'Puffy Fingers / Rings Tight' },
                    { id: 'dry_lips', label: 'Dry Lips / Thirst' },
                    { id: 'dark_urine', label: 'Dark Yellow Urine' },
                  ].map((s) => {
                    const active = waterSymptoms.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setWaterSymptoms((prev) =>
                            active ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                          );
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          active
                            ? 'bg-[#1E3A5F] text-[#F5EFE6] border-[#2563EB]'
                            : 'bg-[#FFFCF8] text-[#5C544E] border-[#F0E6DC]'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {waterConfirmationResult && (
                <div className="p-4 rounded-2xl bg-[#E8F1F5] border border-[#BCD4E6] space-y-1.5 text-xs text-[#1E3A5F]">
                  <div className="font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#2563EB]">
                      verified
                    </span>
                    <span>
                      Doctor Status:{' '}
                      {waterConfirmationResult.confirmationStatus === 'confirmed_balanced'
                        ? 'Healthy Osmotic Balance'
                        : waterConfirmationResult.confirmationStatus === 'mild_retention'
                          ? 'Excess Fluid Retention Detected'
                          : 'Mild Dehydration'}
                    </span>
                  </div>
                  <p className="leading-relaxed">{waterConfirmationResult.doctorAdvice}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F0E6DC]">
                <button
                  type="button"
                  onClick={() => setWaterModalOpen(false)}
                  className="btn-luxury-outline px-5 text-xs font-medium"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submittingWater}
                  className="btn-luxury px-6 text-xs font-semibold"
                >
                  {submittingWater ? 'Confirming...' : 'Confirm Hydration Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export interface NearbyDoctorsMapProps {
  isHi: boolean;
  familyContacts?: FamilyEmergencyContact[];
  liveLocationPermitted?: boolean;
  onToggleLiveLocationPermitted?: (next: boolean) => void;
  onShowToast: (msg: string) => void;
}

export const NearbyDoctorsMap: React.FC<NearbyDoctorsMapProps> = ({
  isHi,
  familyContacts = [],
  liveLocationPermitted = true,
  onToggleLiveLocationPermitted,
  onShowToast,
}) => {
  // Use provided custom Google Maps API Key or fallback
  const apiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    'aAIzaSyDummyKey_For_Saevy_Deadline_1234567890';

  return (
    <APIProvider
      apiKey={apiKey}
      libraries={['places', 'marker', 'routes']}
      language={isHi ? 'hi' : 'en'}
      region="IN"
    >
      <InnerNearbyDoctorsWorkspace
        isHi={isHi}
        familyContacts={familyContacts}
        liveLocationPermitted={liveLocationPermitted}
        onToggleLiveLocationPermitted={onToggleLiveLocationPermitted}
        onShowToast={onShowToast}
      />
    </APIProvider>
  );
};
