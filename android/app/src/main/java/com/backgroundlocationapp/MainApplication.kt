package com.backgroundlocationapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : ReactNativeHost(this) {
        override fun getUseDeveloperSupport(): Boolean {
          return BuildConfig.DEBUG
        }

        override fun getPackages(): List<ReactPackage> {
          // Get default packages from RN
          val packages = PackageList(this).packages.toMutableList()

          // ✅ Replace old OneShotLocationPackage with our new BackgroundLocationPackage
          packages.add(BackgroundLocationPackage())

          return packages
        }

        override fun getJSMainModuleName(): String {
          return "index"
        }
      }

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, false)
  }
}