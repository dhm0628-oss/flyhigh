plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
}

import java.util.Properties

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) {
        file.inputStream().use { load(it) }
    }
}

android {
    namespace = "tv.flyhigh.app"
    compileSdk = 34

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "tv.flyhigh.app.beta"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0-beta"

        val apiBaseUrl = project.findProperty("FLYHIGH_API_BASE_URL")?.toString()
            ?: "http://172.20.10.2:4000"
        val webActivateUrl = project.findProperty("FLYHIGH_WEB_ACTIVATE_URL")?.toString()
            ?: "http://172.20.10.2:3004"

        buildConfigField("String", "FLYHIGH_API_BASE_URL", "\"$apiBaseUrl\"")
        buildConfigField("String", "FLYHIGH_WEB_ACTIVATE_URL", "\"$webActivateUrl\"")
    }

    val uploadStoreFile = localProperties.getProperty("FIRETV_UPLOAD_STORE_FILE")
    val uploadStorePassword = localProperties.getProperty("FIRETV_UPLOAD_STORE_PASSWORD")
    val uploadKeyAlias = localProperties.getProperty("FIRETV_UPLOAD_KEY_ALIAS")
    val uploadKeyPassword = localProperties.getProperty("FIRETV_UPLOAD_KEY_PASSWORD")

    signingConfigs {
        if (
            !uploadStoreFile.isNullOrBlank() &&
            !uploadStorePassword.isNullOrBlank() &&
            !uploadKeyAlias.isNullOrBlank() &&
            !uploadKeyPassword.isNullOrBlank()
        ) {
            create("releaseUpload") {
                storeFile = file(uploadStoreFile)
                storePassword = uploadStorePassword
                keyAlias = uploadKeyAlias
                keyPassword = uploadKeyPassword
            }
        }
    }

    buildTypes {
        getByName("release") {
            if (signingConfigs.findByName("releaseUpload") != null) {
                signingConfig = signingConfigs.getByName("releaseUpload")
            }
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.06.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-compose:1.9.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.4")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.foundation:foundation")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.coil-kt:coil-compose:2.7.0")

    implementation("androidx.media3:media3-exoplayer:1.4.1")
    implementation("androidx.media3:media3-exoplayer-hls:1.4.1")
    implementation("androidx.media3:media3-ui:1.4.1")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
