import { Ionicons } from "@expo/vector-icons";
import {
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Typography } from "../constants/theme";
import type { PortfolioImage } from "../types";

interface Props {
  images: PortfolioImage[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

const { width, height } = Dimensions.get("window");

export function PortfolioLightbox({ images, initialIndex, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

  // Sync when lightbox opens with a new initial index
  React.useEffect(() => {
    if (visible) setCurrentIndex(initialIndex);
  }, [visible, initialIndex]);

  const canPrev = currentIndex > 0;
  const canNext = currentIndex < images.length - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Close button */}
        <TouchableOpacity
          style={[styles.closeButton, { top: insets.top + 12 }]}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>

        {/* Counter */}
        <View style={[styles.counter, { top: insets.top + 16 }]}>
          <Text style={styles.counterText}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>

        {/* Image */}
        {images[currentIndex] && (
          <Image
            source={{ uri: images[currentIndex].image_url }}
            style={styles.image}
            resizeMode="contain"
          />
        )}

        {/* Left arrow */}
        <TouchableOpacity
          style={[styles.arrow, styles.arrowLeft, !canPrev && styles.arrowDisabled]}
          onPress={() => canPrev && setCurrentIndex((i) => i - 1)}
          activeOpacity={canPrev ? 0.7 : 1}
        >
          <Ionicons
            name="chevron-back"
            size={32}
            color={canPrev ? "#fff" : "rgba(255,255,255,0.25)"}
          />
        </TouchableOpacity>

        {/* Right arrow */}
        <TouchableOpacity
          style={[styles.arrow, styles.arrowRight, !canNext && styles.arrowDisabled]}
          onPress={() => canNext && setCurrentIndex((i) => i + 1)}
          activeOpacity={canNext ? 0.7 : 1}
        >
          <Ionicons
            name="chevron-forward"
            size={32}
            color={canNext ? "#fff" : "rgba(255,255,255,0.25)"}
          />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// React needs to be in scope for hooks
import React from "react";

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
  },
  counter: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 10,
  },
  counterText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  image: {
    width,
    height: height * 0.8,
  },
  arrow: {
    position: "absolute",
    top: "50%",
    marginTop: -28,
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 28,
  },
  arrowLeft: {
    left: 12,
  },
  arrowRight: {
    right: 12,
  },
  arrowDisabled: {
    backgroundColor: "rgba(0,0,0,0.2)",
  },
});
