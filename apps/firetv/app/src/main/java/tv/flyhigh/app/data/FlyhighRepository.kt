package tv.flyhigh.app.data

import tv.flyhigh.app.api.*

class FlyhighRepository(
    private val api: FlyhighApiClient
) {
    suspend fun getHomeFeed(): ApiResult<HomeFeedResponse> = api.get("/v1/content/home")

    suspend fun searchCatalog(
        query: String,
        access: String,
        type: String,
        limit: Int = 100,
        offset: Int = 0
    ): ApiResult<CatalogResponse> {
        val params = buildList {
            if (query.isNotBlank()) add("q=${java.net.URLEncoder.encode(query, Charsets.UTF_8)}")
            if (access.isNotBlank() && access != "all") add("access=${java.net.URLEncoder.encode(access, Charsets.UTF_8)}")
            if (type.isNotBlank() && type != "all") add("type=${java.net.URLEncoder.encode(type, Charsets.UTF_8)}")
            add("sort=featured")
            add("limit=$limit")
            add("offset=$offset")
        }.joinToString("&")

        val path = if (params.isBlank()) "/v1/content/catalog" else "/v1/content/catalog?$params"
        return api.get(path)
    }

    suspend fun getContinueWatching(bearerToken: String): ApiResult<ContinueWatchingResponse> =
        api.get("/v1/viewer/continue-watching", bearerToken)

    suspend fun getMyList(bearerToken: String): ApiResult<MyListResponse> =
        api.get("/v1/viewer/my-list", bearerToken)

    suspend fun getMyListStatus(contentId: String, bearerToken: String): ApiResult<MyListStatusResponse> =
        api.get("/v1/viewer/my-list/$contentId", bearerToken)

    suspend fun addToMyList(contentId: String, bearerToken: String): ApiResult<MyListUpdateResponse> =
        api.post("/v1/viewer/my-list", MyListUpdateRequest(contentId), bearerToken)

    suspend fun removeFromMyList(contentId: String, bearerToken: String): ApiResult<MyListUpdateResponse> =
        api.delete("/v1/viewer/my-list/$contentId", bearerToken)

    suspend fun getViewerProgress(contentId: String, bearerToken: String): ApiResult<ViewerProgressResponse> =
        api.get("/v1/viewer/progress/$contentId", bearerToken)

    suspend fun updateViewerProgress(
        contentId: String,
        positionSeconds: Int,
        durationSeconds: Int,
        completed: Boolean,
        bearerToken: String
    ): ApiResult<ViewerProgressUpdateResponse> = api.post(
        "/v1/viewer/progress",
        ViewerProgressUpdateRequest(
            contentId = contentId,
            positionSeconds = positionSeconds,
            durationSeconds = durationSeconds,
            completed = completed
        ),
        bearerToken
    )

    suspend fun startDeviceAuth(clientName: String): ApiResult<DeviceAuthStartResponse> =
        api.post("/v1/device-auth/start", DeviceAuthStartRequest(clientName))

    suspend fun pollDeviceAuth(deviceLoginId: String): ApiResult<DeviceAuthPollResponse> =
        api.post("/v1/device-auth/poll", DeviceAuthPollRequest(deviceLoginId))

    suspend fun requestPlayback(contentId: String, bearerToken: String?): ApiResult<PlaybackAuthorizationResponse> =
        api.postEmpty("/v1/content/$contentId/playback", bearerToken)
}
