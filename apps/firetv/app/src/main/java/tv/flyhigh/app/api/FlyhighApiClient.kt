package tv.flyhigh.app.api

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import tv.flyhigh.app.BuildConfig

const val API_LOG_TAG = "FlyhighApiClient"

class FlyhighApiClient(
    @PublishedApi internal val baseUrl: String = BuildConfig.FLYHIGH_API_BASE_URL,
    @PublishedApi internal val httpClient: OkHttpClient = OkHttpClient(),
    @PublishedApi internal val json: Json = Json { ignoreUnknownKeys = true }
) {
    @PublishedApi
    internal val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend inline fun <reified T> get(path: String, bearerToken: String? = null): ApiResult<T> {
        val request = Request.Builder()
            .url("$baseUrl$path")
            .header("Accept", "application/json")
            .apply {
                if (!bearerToken.isNullOrBlank()) {
                    header("Authorization", "Bearer $bearerToken")
                }
            }
            .get()
            .build()
        return execute(request)
    }

    suspend inline fun <reified T, reified B> post(path: String, body: B, bearerToken: String? = null): ApiResult<T> {
        val payload = json.encodeToString(kotlinx.serialization.serializer<B>(), body)
        val request = Request.Builder()
            .url("$baseUrl$path")
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .apply {
                if (!bearerToken.isNullOrBlank()) {
                    header("Authorization", "Bearer $bearerToken")
                }
            }
            .post(payload.toRequestBody(jsonMediaType))
            .build()
        return execute(request)
    }

    suspend inline fun <reified T> postEmpty(path: String, bearerToken: String? = null): ApiResult<T> {
        val request = Request.Builder()
            .url("$baseUrl$path")
            .header("Accept", "application/json")
            .apply {
                if (!bearerToken.isNullOrBlank()) {
                    header("Authorization", "Bearer $bearerToken")
                }
            }
            .post("{}".toRequestBody(jsonMediaType))
            .build()
        return execute(request)
    }

    suspend inline fun <reified T> delete(path: String, bearerToken: String? = null): ApiResult<T> {
        val request = Request.Builder()
            .url("$baseUrl$path")
            .header("Accept", "application/json")
            .apply {
                if (!bearerToken.isNullOrBlank()) {
                    header("Authorization", "Bearer $bearerToken")
                }
            }
            .delete()
            .build()
        return execute(request)
    }

    suspend inline fun <reified T> execute(request: Request): ApiResult<T> {
        return withContext(Dispatchers.IO) {
            try {
                httpClient.newCall(request).execute().use { response ->
                    val body = response.body?.string().orEmpty()
                    if (response.isSuccessful) {
                        ApiResult.Success(json.decodeFromString(kotlinx.serialization.serializer<T>(), body))
                    } else {
                        val error = runCatching {
                            json.decodeFromString(ApiErrorResponse.serializer(), body)
                        }.getOrNull()
                        Log.w(API_LOG_TAG, "HTTP ${response.code} for ${request.method} ${request.url}: ${error?.error ?: error?.reason ?: body.take(300)}")
                        ApiResult.Error(
                            statusCode = response.code,
                            message = error?.error ?: error?.reason ?: "HTTP ${response.code}",
                            reason = error?.reason
                        )
                    }
                }
            } catch (t: Throwable) {
                Log.e(API_LOG_TAG, "Request failed for ${request.method} ${request.url}", t)
                val detail = t.message?.takeIf { it.isNotBlank() } ?: t::class.java.simpleName
                ApiResult.Error(statusCode = null, message = detail)
            }
        }
    }
}

sealed class ApiResult<out T> {
    data class Success<T>(val value: T) : ApiResult<T>()
    data class Error(val statusCode: Int?, val message: String, val reason: String? = null) : ApiResult<Nothing>()
}
