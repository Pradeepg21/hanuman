import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
}

// Release signing comes from keystore.properties in the project root (never committed).
// See RELEASING.md. Without it, release builds are produced unsigned.
val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) keystorePropsFile.inputStream().use { load(it) }
}

android {
    namespace = "com.satya.hanuman"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "com.satya.hanuman"
        minSdk = 24
        targetSdk = 37
        // RELEASE VERSION: bump BOTH on every change (see RELEASING.md and CHANGELOG.md).
        versionCode = 4
        versionName = "1.1.2"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            if (keystorePropsFile.exists()) {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            if (keystorePropsFile.exists()) signingConfig = signingConfigs.getByName("release")
            optimization {
                enable = false
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

dependencies {
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.core.ktx)
    implementation(libs.material)
    implementation(libs.androidx.webkit)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
}