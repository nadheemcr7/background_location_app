import { NativeModules, Platform } from "react-native";

const { BackgroundLocationModule } = NativeModules;

export const startLocationService = () => {
  if (Platform.OS === "android") {
    BackgroundLocationModule.startService();
  }
};

export const stopLocationService = () => {
  if (Platform.OS === "android") {
    BackgroundLocationModule.stopService();
  }
};
