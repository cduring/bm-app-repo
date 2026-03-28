import Mapbox, { Camera, MapView, PointAnnotation } from "@rnmapbox/maps";
import type { Feature, Point } from "geojson";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BorderRadius, Colors, Spacing } from "../constants/theme";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN!);

interface DraggablePinMapProps {
  pinLatitude: number;
  pinLongitude: number;
  onPinMoved: (latitude: number, longitude: number) => void;
  height?: number;
}

export function DraggablePinMap({
  pinLatitude,
  pinLongitude,
  onPinMoved,
  height = 200,
}: DraggablePinMapProps) {
  // Camera is managed internally so it doesn't fight the user while they pan.
  // It re-centers when: (a) the component first mounts, (b) a new FSA is entered
  // (parent resets pin coords), or (c) the pin is dropped after a drag.
  const [cameraCoord, setCameraCoord] = useState<[number, number]>([
    pinLongitude,
    pinLatitude,
  ]);

  useEffect(() => {
    setCameraCoord([pinLongitude, pinLatitude]);
  }, [pinLatitude, pinLongitude]);

  function handleDragEnd(e: Feature<Point>) {
    const [lng, lat] = e.geometry.coordinates;
    onPinMoved(lat, lng);
    // Parent will update pinLatitude/pinLongitude → useEffect re-centers camera
  }

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        style={styles.map}
        styleURL="mapbox://styles/mapbox/dark-v11"
        scrollEnabled
        zoomEnabled
        pitchEnabled={false}
        rotateEnabled={false}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Camera
          centerCoordinate={cameraCoord}
          zoomLevel={13}
          animationDuration={400}
        />
        <PointAnnotation
          id="user-pin"
          coordinate={[pinLongitude, pinLatitude]}
          draggable
          onDragEnd={handleDragEnd}
        >
          {/* PointAnnotation requires a plain View child — no Text/Icon nodes allowed */}
          <View style={styles.pin} />
        </PointAnnotation>
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  map: {
    flex: 1,
  },
  pin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: "#fff",
  },
});
