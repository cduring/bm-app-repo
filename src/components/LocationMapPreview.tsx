import { Ionicons } from "@expo/vector-icons";
import Mapbox, { Camera, MapView, MarkerView } from "@rnmapbox/maps";
import { StyleSheet, View } from "react-native";
import { BorderRadius, Colors, Spacing } from "../constants/theme";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN!);

interface LocationMapPreviewProps {
  latitude: number;
  longitude: number;
  zoomLevel?: number;
  height?: number;
}

export function LocationMapPreview({
  latitude,
  longitude,
  zoomLevel = 14,
  height = 160,
}: LocationMapPreviewProps) {
  return (
    <View style={[styles.container, { height }]}>
      <MapView
        style={styles.map}
        styleURL="mapbox://styles/mapbox/dark-v11"
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Camera
          centerCoordinate={[longitude, latitude]}
          zoomLevel={zoomLevel}
          animationDuration={0}
        />
        <MarkerView
          coordinate={[longitude, latitude]}
          anchor={{ x: 0.5, y: 0.5 }}
          allowOverlap
        >
          <View style={styles.pin}>
            <Ionicons name="location" size={16} color="#fff" />
          </View>
        </MarkerView>
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
});
