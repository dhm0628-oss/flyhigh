package tv.flyhigh.app.ui

import tv.flyhigh.app.api.CollectionRow
import tv.flyhigh.app.api.ContentCard
import tv.flyhigh.app.api.ViewerProgressResponse

data class DeviceAuthUiState(
    val visible: Boolean = false,
    val deviceLoginId: String? = null,
    val userCode: String? = null,
    val verificationUrl: String? = null,
    val statusText: String = ""
)

sealed interface AppScreen {
    data object Home : AppScreen
    data object Search : AppScreen
    data class Detail(
        val item: ContentCard,
        val progress: ViewerProgressResponse? = null,
        val isLoadingProgress: Boolean = false,
        val loadError: String? = null
    ) : AppScreen
    data class Player(
        val contentId: String,
        val title: String,
        val playbackUrl: String,
        val durationSeconds: Int,
        val resumePositionSeconds: Int = 0
    ) : AppScreen
}

data class FireTvUiState(
    val loading: Boolean = false,
    val statusMessage: String = "",
    val errorMessage: String? = null,
    val featuredItems: List<ContentCard> = emptyList(),
    val rows: List<CollectionRow> = emptyList(),
    val continueProgressByContentId: Map<String, Int> = emptyMap(),
    val myListContentIds: Set<String> = emptySet(),
    val selected: ContentCard? = null,
    val tokenLoaded: Boolean = false,
    val deviceAuth: DeviceAuthUiState = DeviceAuthUiState(),
    val screen: AppScreen = AppScreen.Home
)
