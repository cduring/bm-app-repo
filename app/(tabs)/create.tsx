import { StyleSheet, View } from "react-native";
import CreateEventForm from "../../src/components/CreateEventForm";

export default function CreateScreen() {
  return (
    <View style={styles.container}>
      <CreateEventForm />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 80,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
});
