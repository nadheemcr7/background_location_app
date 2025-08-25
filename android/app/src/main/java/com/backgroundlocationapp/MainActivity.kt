package com.backgroundlocationapp

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String {
    return "BackgroundLocationApp" // 👈 must match the name in app.json
  }
}