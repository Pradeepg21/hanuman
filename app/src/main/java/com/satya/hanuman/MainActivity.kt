package com.satya.hanuman

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebResourceResponse
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader

/**
 * Hosts the Hanuman Run 3D game. The game itself (Three.js + WebGL) lives in
 * app/src/main/assets/game and is served from a local https origin so that
 * saves in localStorage persist reliably.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) WebView.setWebContentsDebuggingEnabled(true)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.cacheMode = WebSettings.LOAD_NO_CACHE
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            isHapticFeedbackEnabled = false
            overScrollMode = WebView.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    assetLoader.shouldInterceptRequest(request.url)
            }
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                    Log.d(TAG, "${m.messageLevel()} ${m.message()} (${m.sourceId()}:${m.lineNumber()})")
                    return true
                }
            }
            addJavascriptInterface(Bridge(this@MainActivity), "Android")
        }
        setContentView(webView)
        hideSystemBars()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("window.onAndroidBack ? window.onAndroidBack() : 'exit'") { result ->
                    if (result == null || result.contains("exit")) finish()
                }
            }
        })

        if (savedInstanceState != null) webView.restoreState(savedInstanceState)
        else webView.loadUrl("https://appassets.androidplatform.net/assets/game/index.html")
    }

    private fun hideSystemBars() {
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.systemBars())
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    override fun onPause() {
        webView.evaluateJavascript("window.gamePause && window.gamePause()", null)
        webView.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    private companion object {
        const val TAG = "HanumanRun"
    }

    /** Small native bridge used by the game for haptics. */
    private class Bridge(context: Context) {
        private val version: String = try {
            val info = context.packageManager.getPackageInfo(context.packageName, 0)
            val code = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else {
                @Suppress("DEPRECATION")
                info.versionCode.toLong()
            }
            "${info.versionName} ($code)"
        } catch (e: Exception) {
            "unknown"
        }

        private val vibrator: Vibrator? =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }

        @JavascriptInterface
        fun getVersion(): String = version

        @JavascriptInterface
        fun vibrate(ms: Int) {
            val v = vibrator ?: return
            val duration = ms.coerceIn(1, 1000).toLong()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                v.vibrate(duration)
            }
        }
    }
}
