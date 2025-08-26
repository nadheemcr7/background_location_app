# Keep background location service
-keep class com.backgroundlocationapp.LocationService { *; }
-keep class com.backgroundlocationapp.BackgroundLocationService { *; }

# Keep React Native modules
-keep class com.backgroundlocationapp.BackgroundLocationModule { *; }
-keep class com.backgroundlocationapp.BackgroundLocationPackage { *; }

# Keep SQLite helper
-keep class com.backgroundlocationapp.LocationDatabaseHelper { *; }

# Keep JSON classes
-keep class org.json.** { *; }
-dontwarn org.json.**