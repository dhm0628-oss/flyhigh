package tv.flyhigh.app.data

import android.content.Context

class AuthTokenStore(context: Context) {
    private val prefs = context.getSharedPreferences("flyhigh_firetv", Context.MODE_PRIVATE)

    fun getAccessToken(): String? = prefs.getString("device_access_token", null)

    fun saveAccessToken(token: String) {
        prefs.edit().putString("device_access_token", token).apply()
    }

    fun clear() {
        prefs.edit().remove("device_access_token").apply()
    }
}

