import { StyleSheet, View } from "react-native";
import CreateEventForm from "../src/components/CreateEventForm";

export default function HostScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.sheet}>
        <CreateEventForm />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  sheet: {
    flex: 1,
    marginTop: 80,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
});
