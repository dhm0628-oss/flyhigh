package tv.flyhigh.app.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class HomeFeedResponse(
    val featured: ContentCard? = null,
    val featuredItems: List<ContentCard> = emptyList(),
    val rows: List<CollectionRow> = emptyList()
)

@Serializable
data class CatalogResponse(
    val total: Int,
    val limit: Int,
    val offset: Int,
    val hasMore: Boolean,
    val items: List<ContentCard>
)

@Serializable
data class CollectionRow(
    val id: String,
    val title: String,
    val items: List<ContentCard>
)

@Serializable
data class ContentCard(
    val id: String,
    val slug: String,
    val title: String,
    val synopsis: String,
    val type: String,
    val posterUrl: String,
    val durationSeconds: Int,
    val releaseYear: Int? = null,
    val tags: List<String> = emptyList(),
    val isPremium: Boolean
)

@Serializable
data class DeviceAuthStartRequest(val clientName: String)

@Serializable
data class DeviceAuthStartResponse(
    val deviceLoginId: String,
    val userCode: String,
    val verificationUri: String,
    val verificationUriComplete: String,
    val expiresAt: String,
    val intervalSeconds: Int = 5
)

@Serializable
data class DeviceAuthPollRequest(val deviceLoginId: String)

@Serializable
data class ViewerProfile(
    val id: String,
    val email: String,
    val displayName: String,
    val subscriptionStatus: String
)

@Serializable
data class DeviceAuthPollResponse(
    val status: String,
    val intervalSeconds: Int? = null,
    val accessToken: String? = null,
    val viewer: ViewerProfile? = null
)

@Serializable
data class PlaybackAuthorizationResponse(
    val contentId: String,
    val allowed: Boolean,
    val reason: String? = null,
    val playbackUrl: String? = null,
    val expiresAt: String? = null
)

@Serializable
data class MyListResponse(
    val title: String,
    val items: List<ContentCard>
)

@Serializable
data class MyListStatusResponse(
    val contentId: String,
    val inMyList: Boolean
)

@Serializable
data class MyListUpdateRequest(
    val contentId: String
)

@Serializable
data class MyListUpdateResponse(
    val ok: Boolean,
    val contentId: String,
    val inMyList: Boolean
)

@Serializable
data class ContinueWatchingResponse(
    val title: String,
    val items: List<ContinueWatchingItem>
)

@Serializable
data class ContinueWatchingItem(
    val id: String,
    val slug: String,
    val title: String,
    val synopsis: String,
    val type: String,
    val posterUrl: String,
    val durationSeconds: Int,
    val releaseYear: Int? = null,
    val tags: List<String> = emptyList(),
    val isPremium: Boolean,
    val progressPercent: Int,
    val positionSeconds: Int,
    val lastPlayedAt: String? = null
)

@Serializable
data class ViewerProgressResponse(
    val contentId: String,
    val hasProgress: Boolean,
    val positionSeconds: Int,
    val progressPercent: Int,
    val completed: Boolean,
    val lastPlayedAt: String? = null
)

@Serializable
data class ViewerProgressUpdateRequest(
    val contentId: String,
    val positionSeconds: Int,
    val durationSeconds: Int,
    val completed: Boolean = false
)

@Serializable
data class ViewerProgressUpdateResponse(
    val ok: Boolean,
    val contentId: String,
    val positionSeconds: Int,
    val progressPercent: Int,
    val completed: Boolean
)

@Serializable
data class ApiErrorResponse(
    val error: String? = null,
    val reason: String? = null
)
