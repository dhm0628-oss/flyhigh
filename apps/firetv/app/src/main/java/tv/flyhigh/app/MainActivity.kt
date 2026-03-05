package tv.flyhigh.app

import android.os.Bundle
import androidx.activity.compose.BackHandler
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.Alignment
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import coil.compose.AsyncImage
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import tv.flyhigh.app.api.*
import tv.flyhigh.app.data.AuthTokenStore
import tv.flyhigh.app.data.FlyhighRepository
import tv.flyhigh.app.ui.AppScreen
import tv.flyhigh.app.ui.DeviceAuthUiState
import tv.flyhigh.app.ui.FireTvUiState

class MainActivity : ComponentActivity() {
    private lateinit var repository: FlyhighRepository
    private lateinit var tokenStore: AuthTokenStore
    private var devicePollJob: Job? = null

    private enum class PlayMode {
        Auto,
        Resume,
        Restart
    }

    private data class HomeRowsResult(
        val rows: List<CollectionRow>,
        val continueProgressByContentId: Map<String, Int> = emptyMap(),
        val myListContentIds: Set<String> = emptySet()
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        repository = FlyhighRepository(FlyhighApiClient())
        tokenStore = AuthTokenStore(this)

        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                FireTvApp()
            }
        }
    }

    @Composable
    private fun FireTvApp() {
        var ui by remember {
            mutableStateOf(
                FireTvUiState(
                    loading = true,
                    statusMessage = "Loading home feed...",
                    tokenLoaded = !tokenStore.getAccessToken().isNullOrBlank()
                )
            )
        }

        LaunchedEffect(Unit) {
            loadHomeFeed { ui = it }
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF07131A))
                .padding(24.dp)
        ) {
            when (val screen = ui.screen) {
                is AppScreen.Home -> HomeScreen(
                    state = ui,
                    onSelect = { item -> ui = ui.copy(selected = item) },
                    onOpenSearch = { ui = ui.copy(screen = AppScreen.Search, statusMessage = "Search catalog") },
                    onOpenDetail = { item ->
                        openDetail(
                            item = item,
                            onState = { ui = it },
                            current = { ui }
                        )
                    },
                    onPlay = { item ->
                        requestPlayback(
                            item = item,
                            playMode = PlayMode.Auto,
                            onState = { ui = it },
                            current = { ui }
                        )
                    },
                    onStartDeviceSignIn = {
                        startDeviceAuth(
                            onState = { ui = it },
                            current = { ui }
                        )
                    },
                    onRetryHome = {
                        ui = ui.copy(loading = true, statusMessage = "Retrying home feed...", errorMessage = null)
                        reloadHomeFeed { ui = it }
                    }
                )

                is AppScreen.Search -> SearchScreen(
                    rows = ui.rows,
                    loading = ui.loading,
                    errorMessage = ui.errorMessage,
                    statusMessage = ui.statusMessage,
                    continueProgressByContentId = ui.continueProgressByContentId,
                    onSearchCatalog = { q, access, type -> repository.searchCatalog(q, access, type) },
                    onBack = { ui = ui.copy(screen = AppScreen.Home) },
                    onOpenDetail = { item ->
                        openDetail(
                            item = item,
                            onState = { ui = it },
                            current = { ui }
                        )
                    }
                )

                is AppScreen.Detail -> DetailScreen(
                    item = screen.item,
                    progress = screen.progress,
                    isLoadingProgress = screen.isLoadingProgress,
                    loadError = screen.loadError,
                    inMyList = ui.myListContentIds.contains(screen.item.id),
                    continueProgressPercent = ui.continueProgressByContentId[screen.item.id],
                    onBack = { ui = ui.copy(screen = AppScreen.Home) },
                    onToggleMyList = { shouldAdd ->
                        if (shouldAdd) {
                            addToMyList(
                                item = screen.item,
                                onState = { ui = it },
                                current = { ui }
                            )
                        } else {
                            removeFromMyList(
                                item = screen.item,
                                onState = { ui = it },
                                current = { ui }
                            )
                        }
                    },
                    onPlay = {
                        requestPlayback(
                            item = screen.item,
                            playMode = PlayMode.Auto,
                            onState = { ui = it },
                            current = { ui }
                        )
                    },
                    onResume = {
                        requestPlayback(
                            item = screen.item,
                            playMode = PlayMode.Resume,
                            onState = { ui = it },
                            current = { ui }
                        )
                    },
                    onRestart = {
                        requestPlayback(
                            item = screen.item,
                            playMode = PlayMode.Restart,
                            onState = { ui = it },
                            current = { ui }
                        )
                    }
                )

                is AppScreen.Player -> PlayerScreen(
                    contentId = screen.contentId,
                    title = screen.title,
                    playbackUrl = screen.playbackUrl,
                    durationSeconds = screen.durationSeconds,
                    resumePositionSeconds = screen.resumePositionSeconds,
                    onProgress = { contentId, positionSeconds, duration, completed ->
                        saveViewerProgress(contentId, positionSeconds, duration, completed)
                    },
                    onRetry = {
                        val selected = ui.selected
                        if (selected != null) {
                            requestPlayback(
                                item = selected,
                                playMode = PlayMode.Auto,
                                onState = { ui = it },
                                current = { ui }
                            )
                        } else {
                            ui = ui.copy(screen = AppScreen.Home, statusMessage = "Select a title to retry playback")
                        }
                    },
                    onBack = { ui = ui.copy(screen = AppScreen.Home) }
                )
            }

            if (ui.deviceAuth.visible) {
                DeviceAuthOverlay(
                    state = ui.deviceAuth,
                    onRestart = {
                        startDeviceAuth(
                            onState = { ui = it },
                            current = { ui }
                        )
                    },
                    onDismiss = {
                        devicePollJob?.cancel()
                        ui = ui.copy(deviceAuth = ui.deviceAuth.copy(visible = false))
                    }
                )
            }
        }
    }

    private suspend fun loadHomeFeed(onState: (FireTvUiState) -> Unit) {
        val result = repository.getHomeFeed()
        when (result) {
            is ApiResult.Success -> {
                val baseRows = result.value.rows
                val featuredItems = if (result.value.featuredItems.isNotEmpty()) {
                    result.value.featuredItems
                } else {
                    result.value.featured?.let { listOf(it) } ?: emptyList()
                }
                val enriched = loadRowsWithContinueWatching(baseRows)
                val rows = enriched.rows
                val first = featuredItems.firstOrNull() ?: rows.firstOrNull()?.items?.firstOrNull()
                onState(
                    FireTvUiState(
                        loading = false,
                        statusMessage = if (rows.size > baseRows.size) {
                            "Loaded ${baseRows.size} rows + Continue Watching"
                        } else {
                            "Loaded ${baseRows.size} rows"
                        },
                        errorMessage = null,
                        featuredItems = featuredItems,
                        rows = rows,
                        continueProgressByContentId = enriched.continueProgressByContentId,
                        myListContentIds = enriched.myListContentIds,
                        selected = first,
                        tokenLoaded = !tokenStore.getAccessToken().isNullOrBlank()
                    )
                )
            }

            is ApiResult.Error -> {
                onState(
                    FireTvUiState(
                        loading = false,
                        statusMessage = "Home feed error: ${result.message}",
                        errorMessage = result.message,
                        tokenLoaded = !tokenStore.getAccessToken().isNullOrBlank()
                    )
                )
            }
        }
    }

    private fun reloadHomeFeed(onState: (FireTvUiState) -> Unit) {
        lifecycleScope.launch {
            loadHomeFeed(onState)
        }
    }

    private suspend fun loadRowsWithContinueWatching(baseRows: List<CollectionRow>): HomeRowsResult {
        val token = tokenStore.getAccessToken().orEmpty()
        if (token.isBlank()) return HomeRowsResult(baseRows)

        var rows = baseRows
        var continueProgressByContentId = emptyMap<String, Int>()
        var myListContentIds = emptySet<String>()

        when (val myListResult = repository.getMyList(token)) {
            is ApiResult.Success -> {
                val items = myListResult.value.items
                myListContentIds = items.map { it.id }.toSet()
                if (items.isNotEmpty()) {
                    val myListRow = CollectionRow(
                        id = "my-list",
                        title = myListResult.value.title,
                        items = items
                    )
                    rows = listOf(myListRow) + rows
                }
            }

            is ApiResult.Error -> {
                // Ignore and keep base rows.
            }
        }

        when (val continueResult = repository.getContinueWatching(token)) {
            is ApiResult.Success -> {
                if (continueResult.value.items.isNotEmpty()) {
                    continueProgressByContentId = continueResult.value.items.associate { it.id to it.progressPercent.coerceIn(0, 100) }
                    val continueRow = CollectionRow(
                        id = "continue-watching",
                        title = continueResult.value.title,
                        items = continueResult.value.items.map { item ->
                            ContentCard(
                                id = item.id,
                                slug = item.slug,
                                title = item.title,
                                synopsis = item.synopsis,
                                type = item.type,
                                posterUrl = item.posterUrl,
                                durationSeconds = item.durationSeconds,
                                releaseYear = item.releaseYear,
                                tags = item.tags,
                                isPremium = item.isPremium
                            )
                        }
                    )
                    rows = listOf(continueRow) + rows
                }
            }

            is ApiResult.Error -> {
                // Ignore and keep any rows loaded so far.
            }
        }

        return HomeRowsResult(
            rows = rows,
            continueProgressByContentId = continueProgressByContentId,
            myListContentIds = myListContentIds
        )
    }

    private fun requestPlayback(
        item: ContentCard,
        playMode: PlayMode,
        onState: (FireTvUiState) -> Unit,
        current: () -> FireTvUiState
    ) {
        lifecycleScope.launch {
            onState(current().copy(statusMessage = "Requesting playback for ${item.title}"))
            val token = tokenStore.getAccessToken()
            val resumePositionSeconds = if (playMode == PlayMode.Restart) {
                0
            } else if (!token.isNullOrBlank()) {
                when (val progress = repository.getViewerProgress(item.id, token)) {
                    is ApiResult.Success ->
                        if (
                            (playMode == PlayMode.Resume || playMode == PlayMode.Auto) &&
                            progress.value.hasProgress &&
                            !progress.value.completed
                        ) {
                            progress.value.positionSeconds
                        } else {
                            0
                        }

                    is ApiResult.Error -> 0
                }
            } else {
                0
            }

            when (val result = repository.requestPlayback(item.id, token)) {
                is ApiResult.Success -> {
                    val payload = result.value
                    if (payload.allowed && !payload.playbackUrl.isNullOrBlank()) {
                        onState(
                            current().copy(
                                statusMessage = "Playing ${item.title}",
                                screen = AppScreen.Player(
                                    contentId = item.id,
                                    title = item.title,
                                    playbackUrl = payload.playbackUrl,
                                    durationSeconds = item.durationSeconds,
                                    resumePositionSeconds = resumePositionSeconds
                                )
                            )
                        )
                    } else if (payload.reason == "requires_subscription") {
                        onState(current().copy(statusMessage = "Subscription required"))
                        startDeviceAuth(onState, current)
                    } else {
                        onState(current().copy(statusMessage = "Playback unavailable"))
                    }
                }

                is ApiResult.Error -> {
                    if (result.reason == "requires_subscription") {
                        if (token.isNullOrBlank()) {
                            onState(current().copy(statusMessage = "Sign in required"))
                            startDeviceAuth(onState, current)
                        } else {
                            onState(current().copy(statusMessage = "Subscription required. Go to flyhigh.tv/subscribe"))
                        }
                    } else {
                        onState(current().copy(statusMessage = "Playback error: ${result.message}"))
                    }
                }
            }
        }
    }

    private fun openDetail(
        item: ContentCard,
        onState: (FireTvUiState) -> Unit,
        current: () -> FireTvUiState
    ) {
        lifecycleScope.launch {
            onState(
                current().copy(
                    statusMessage = "Loading details for ${item.title}...",
                    selected = item,
                    screen = AppScreen.Detail(
                        item = item,
                        progress = null,
                        isLoadingProgress = true,
                        loadError = null
                    )
                )
            )
            val token = tokenStore.getAccessToken()
            var progressLoadError: String? = null
            val progress = if (!token.isNullOrBlank()) {
                when (val result = repository.getViewerProgress(item.id, token)) {
                    is ApiResult.Success -> result.value
                    is ApiResult.Error -> {
                        progressLoadError = result.message
                        null
                    }
                }
            } else {
                null
            }

            onState(
                current().copy(
                    statusMessage = "Viewing details for ${item.title}",
                    selected = item,
                    screen = AppScreen.Detail(
                        item = item,
                        progress = progress,
                        isLoadingProgress = false,
                        loadError = progressLoadError
                    )
                )
            )
        }
    }

    private fun addToMyList(
        item: ContentCard,
        onState: (FireTvUiState) -> Unit,
        current: () -> FireTvUiState
    ) {
        val token = tokenStore.getAccessToken().orEmpty()
        if (token.isBlank()) {
            onState(current().copy(statusMessage = "Sign in required for My List"))
            return
        }

        lifecycleScope.launch {
            onState(current().copy(statusMessage = "Adding ${item.title} to My List..."))
            when (val result = repository.addToMyList(item.id, token)) {
                is ApiResult.Success -> {
                    val nextIds = current().myListContentIds + item.id
                    onState(
                        current().copy(
                            statusMessage = "Added to My List",
                            myListContentIds = nextIds,
                            rows = upsertMyListRows(current().rows, item, add = true)
                        )
                    )
                }

                is ApiResult.Error -> {
                    onState(current().copy(statusMessage = "My List add failed: ${result.message}"))
                }
            }
        }
    }

    private fun removeFromMyList(
        item: ContentCard,
        onState: (FireTvUiState) -> Unit,
        current: () -> FireTvUiState
    ) {
        val token = tokenStore.getAccessToken().orEmpty()
        if (token.isBlank()) {
            onState(current().copy(statusMessage = "Sign in required for My List"))
            return
        }

        lifecycleScope.launch {
            onState(current().copy(statusMessage = "Removing ${item.title} from My List..."))
            when (val result = repository.removeFromMyList(item.id, token)) {
                is ApiResult.Success -> {
                    val nextIds = current().myListContentIds - item.id
                    onState(
                        current().copy(
                            statusMessage = "Removed from My List",
                            myListContentIds = nextIds,
                            rows = upsertMyListRows(current().rows, item, add = false)
                        )
                    )
                }

                is ApiResult.Error -> {
                    onState(current().copy(statusMessage = "My List remove failed: ${result.message}"))
                }
            }
        }
    }

    private fun upsertMyListRows(rows: List<CollectionRow>, item: ContentCard, add: Boolean): List<CollectionRow> {
        val existingIndex = rows.indexOfFirst { it.id == "my-list" }
        if (add) {
            if (existingIndex >= 0) {
                val existing = rows[existingIndex]
                val nextItems = if (existing.items.any { it.id == item.id }) existing.items else listOf(item) + existing.items
                return rows.toMutableList().also { it[existingIndex] = existing.copy(items = nextItems) }
            }
            val newRow = CollectionRow(id = "my-list", title = "My List", items = listOf(item))
            return listOf(newRow) + rows
        }

        if (existingIndex < 0) return rows
        val existing = rows[existingIndex]
        val nextItems = existing.items.filterNot { it.id == item.id }
        val mutable = rows.toMutableList()
        if (nextItems.isEmpty()) {
            mutable.removeAt(existingIndex)
        } else {
            mutable[existingIndex] = existing.copy(items = nextItems)
        }
        return mutable
    }

    private fun startDeviceAuth(
        onState: (FireTvUiState) -> Unit,
        current: () -> FireTvUiState
    ) {
        devicePollJob?.cancel()
        lifecycleScope.launch {
            onState(
                current().copy(
                    deviceAuth = DeviceAuthUiState(
                        visible = true,
                        statusText = "Requesting device code..."
                    )
                )
            )

            when (val result = repository.startDeviceAuth("firetv-dev")) {
                is ApiResult.Success -> {
                    val res = result.value
                    onState(
                        current().copy(
                            deviceAuth = DeviceAuthUiState(
                                visible = true,
                                deviceLoginId = res.deviceLoginId,
                                userCode = res.userCode,
                                verificationUrl = "${BuildConfig.FLYHIGH_WEB_ACTIVATE_URL}${res.verificationUriComplete}",
                                statusText = "Approve this code on the web (expires ${res.expiresAt})"
                            )
                        )
                    )
                    startDevicePollLoop(res.deviceLoginId, res.intervalSeconds, onState, current)
                }

                is ApiResult.Error -> {
                    onState(
                        current().copy(
                            deviceAuth = DeviceAuthUiState(
                                visible = true,
                                statusText = "Device auth error: ${result.message}"
                            )
                        )
                    )
                }
            }
        }
    }

    private fun startDevicePollLoop(
        deviceLoginId: String,
        intervalSeconds: Int,
        onState: (FireTvUiState) -> Unit,
        current: () -> FireTvUiState
    ) {
        devicePollJob?.cancel()
        devicePollJob = lifecycleScope.launch {
            while (true) {
                delay(intervalSeconds.coerceAtLeast(2).toLong() * 1000)
                when (val result = repository.pollDeviceAuth(deviceLoginId)) {
                    is ApiResult.Success -> {
                        when (result.value.status.lowercase()) {
                            "pending" -> onState(
                                current().copy(
                                    deviceAuth = current().deviceAuth.copy(statusText = "Waiting for approval...")
                                )
                            )

                            "approved" -> {
                                val token = result.value.accessToken.orEmpty()
                                if (token.isNotBlank()) tokenStore.saveAccessToken(token)
                                onState(
                                    current().copy(
                                        tokenLoaded = true,
                                        statusMessage = "TV sign-in complete",
                                        deviceAuth = current().deviceAuth.copy(
                                            visible = false,
                                            statusText = "Approved"
                                        )
                                    )
                                )
                                reloadHomeFeed(onState)
                                break
                            }

                            "expired", "denied", "consumed" -> {
                                onState(
                                    current().copy(
                                        deviceAuth = current().deviceAuth.copy(
                                            statusText = "Code ${result.value.status.lowercase()}. Start sign-in again."
                                        )
                                    )
                                )
                                break
                            }
                        }
                    }

                    is ApiResult.Error -> {
                        onState(
                            current().copy(
                                deviceAuth = current().deviceAuth.copy(
                                    statusText = "Polling error: ${result.message}"
                                )
                            )
                        )
                        break
                    }
                }
            }
        }
    }

    private fun saveViewerProgress(
        contentId: String,
        positionSeconds: Int,
        durationSeconds: Int,
        completed: Boolean
    ) {
        val token = tokenStore.getAccessToken().orEmpty()
        if (token.isBlank()) return

        lifecycleScope.launch {
            repository.updateViewerProgress(
                contentId = contentId,
                positionSeconds = positionSeconds.coerceAtLeast(0),
                durationSeconds = durationSeconds.coerceAtLeast(0),
                completed = completed,
                bearerToken = token
            )
        }
    }
}

@Composable
private fun HomeScreen(
    state: FireTvUiState,
    onSelect: (ContentCard) -> Unit,
    onOpenSearch: () -> Unit,
    onOpenDetail: (ContentCard) -> Unit,
    onPlay: (ContentCard) -> Unit,
    onStartDeviceSignIn: () -> Unit,
    onRetryHome: () -> Unit
) {
    var heroIndex by remember(state.featuredItems) { mutableIntStateOf(0) }
    LaunchedEffect(state.featuredItems.size) {
        if (state.featuredItems.size <= 1) {
            heroIndex = 0
            return@LaunchedEffect
        }
        while (true) {
            delay(6000)
            heroIndex = (heroIndex + 1) % state.featuredItems.size
        }
    }
    val heroItem = if (state.featuredItems.isEmpty()) {
        null
    } else {
        state.featuredItems[heroIndex.coerceIn(0, state.featuredItems.lastIndex)]
    }

    Row(modifier = Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
        Column(modifier = Modifier.weight(1f)) {
            Text("FlyHigh TV", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Text(state.statusMessage, style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(8.dp))
            Text(
                if (state.tokenLoaded) "TV signed in" else "TV not signed in",
                style = MaterialTheme.typography.bodyMedium,
                color = if (state.tokenLoaded) Color(0xFF9BE8D5) else Color(0xFFFFD29D)
            )
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                TvButton(onClick = onOpenSearch) {
                    Text("Search")
                }
                TvOutlinedButton(onClick = onStartDeviceSignIn) {
                    Text("Sign In On TV")
                }
            }
            Spacer(Modifier.height(16.dp))

            if (state.loading && state.rows.isEmpty()) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = Color(0x220C1F29),
                    tonalElevation = 2.dp
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Loading catalog...", style = MaterialTheme.typography.bodyLarge)
                        LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = Color(0xFF57D7FF))
                    }
                }
                Spacer(Modifier.height(14.dp))
            }

            if (!state.loading && state.errorMessage != null && state.rows.isEmpty()) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = Color(0x33A61D24),
                    tonalElevation = 2.dp
                ) {
                    Text(
                        "Could not load catalog: ${state.errorMessage}",
                        modifier = Modifier.padding(16.dp),
                        color = Color(0xFFFFD7D9)
                    )
                }
                Spacer(Modifier.height(8.dp))
                TvOutlinedButton(onClick = onRetryHome) {
                    Text("Retry Home Feed")
                }
                Spacer(Modifier.height(14.dp))
            }

            if (heroItem != null) {
                HeroBanner(
                    item = heroItem,
                    index = heroIndex,
                    total = state.featuredItems.size,
                    onPlay = { onPlay(heroItem) },
                    onDetails = { onOpenDetail(heroItem) }
                )
                Spacer(Modifier.height(16.dp))
            }

            LazyColumn(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                items(state.rows) { row ->
                    Column {
                        Text(row.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(8.dp))
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            items(row.items) { item ->
                                ContentTile(
                                    item = item,
                                    progressPercent = state.continueProgressByContentId[item.id],
                                    isSelected = state.selected?.id == item.id,
                                    onSelect = { onSelect(item) },
                                    onOpenDetail = { onOpenDetail(item) }
                                )
                            }
                        }
                    }
                }
            }
        }

        Surface(
            modifier = Modifier.width(360.dp).fillMaxHeight(),
            color = Color(0x330C1F29),
            tonalElevation = 4.dp
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                val selected = state.selected
                Text(selected?.title ?: "Select a title", style = MaterialTheme.typography.headlineSmall)
                Text(
                    if (selected == null) "" else "${selected.type} | ${selected.releaseYear ?: "n/a"} | ${selected.durationSeconds / 60} min",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFFB7C9D4)
                )
                Text(
                    selected?.synopsis ?: "",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFFDDE8EE)
                )
                Spacer(Modifier.height(8.dp))
                if (selected != null) {
                    TvButton(onClick = { onOpenDetail(selected) }, modifier = Modifier.fillMaxWidth()) {
                        Text("Details")
                    }
                    Spacer(Modifier.height(8.dp))
                    TvOutlinedButton(onClick = { onPlay(selected) }, modifier = Modifier.fillMaxWidth()) {
                        Text("Play")
                    }
                    Spacer(Modifier.height(8.dp))
                    TvOutlinedButton(onClick = onOpenSearch, modifier = Modifier.fillMaxWidth()) {
                        Text("Search Catalog")
                    }
                }
            }
        }
    }
}

@Composable
private fun HeroBanner(
    item: ContentCard,
    index: Int,
    total: Int,
    onPlay: () -> Unit,
    onDetails: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(220.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0x220C1F29))
            .border(1.dp, Color(0x443E93AC), RoundedCornerShape(14.dp))
    ) {
        AsyncImage(
            model = item.posterUrl.takeIf { it.isNotBlank() },
            contentDescription = item.title,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0x99210E14))
        )
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Featured", style = MaterialTheme.typography.labelMedium, color = Color(0xFFD1ECF8))
                Text(item.title, style = MaterialTheme.typography.headlineSmall, maxLines = 2)
                Text(
                    item.synopsis,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFFDDE8EE),
                    maxLines = 3
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TvButton(onClick = onPlay) { Text("Play") }
                    TvOutlinedButton(onClick = onDetails) { Text("Details") }
                }
                Text("${index + 1}/$total", style = MaterialTheme.typography.bodySmall, color = Color(0xFFB7C9D4))
            }
        }
    }
}

@Composable
private fun ContentTile(
    item: ContentCard,
    progressPercent: Int?,
    isSelected: Boolean,
    onSelect: () -> Unit,
    onOpenDetail: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (isFocused) 1.03f else 1f, label = "tileScale")
    Box(
        modifier = Modifier
            .width(292.dp)
            .height(164.dp)
            .scale(scale)
            .clip(RoundedCornerShape(12.dp))
            .onFocusChanged {
                isFocused = it.isFocused
                if (it.isFocused) onSelect()
            }
            .focusable()
            .clickable {
                onSelect()
                onOpenDetail()
            }
            .border(
                width = if (isFocused || isSelected) 2.dp else 1.dp,
                color = if (isFocused) Color(0xFFA6EEFF) else if (isSelected) Color(0xFF57D7FF) else Color(0x33000000),
                shape = RoundedCornerShape(12.dp)
            )
    ) {
        AsyncImage(
            model = item.posterUrl.takeIf { it.isNotBlank() },
            contentDescription = item.title,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    when {
                        isFocused -> Color(0x554C7380)
                        isSelected -> Color(0x66354B55)
                        else -> Color(0x88210E14)
                    }
                )
        )
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(item.title, style = MaterialTheme.typography.titleSmall, maxLines = 1)
                Text(
                    "${item.type.uppercase()} • ${item.durationSeconds / 60} min",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFFE1EEF4)
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    if (item.isPremium) "Subscriber only" else "Free",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFFF5FCFF)
                )
                if (progressPercent != null && progressPercent > 0) {
                    LinearProgressIndicator(
                        progress = { (progressPercent.coerceIn(0, 100)) / 100f },
                        modifier = Modifier.fillMaxWidth().height(4.dp),
                        color = Color(0xFF57D7FF),
                        trackColor = Color(0x553A5563)
                    )
                }
            }
        }
    }
}

@Composable
private fun DeviceAuthOverlay(
    state: DeviceAuthUiState,
    onRestart: () -> Unit,
    onDismiss: () -> Unit
) {
    val closeRequester = remember { FocusRequester() }
    BackHandler(onBack = onDismiss)
    LaunchedEffect(state.visible, state.userCode) {
        closeRequester.requestFocus()
    }

    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xAA000000)),
        contentAlignment = Alignment.Center
    ) {
        Surface(modifier = Modifier.width(760.dp), color = Color(0xFF041016)) {
            Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Sign in on the web", style = MaterialTheme.typography.headlineSmall)
                Text(
                    state.userCode ?: "------",
                    style = MaterialTheme.typography.displayMedium,
                    color = Color(0xFF57D7FF)
                )
                Text(
                    state.verificationUrl ?: "Open /activate on Flyhigh.tv",
                    style = MaterialTheme.typography.bodyLarge
                )
                Text(state.statusText, style = MaterialTheme.typography.bodyMedium, color = Color(0xFFB7C9D4))
                TvButton(onClick = onRestart) {
                    Text("Get New Code")
                }
                TvOutlinedButton(onClick = onDismiss, modifier = Modifier.focusRequester(closeRequester)) {
                    Text("Close")
                }
            }
        }
    }
}

@Composable
private fun SearchScreen(
    rows: List<CollectionRow>,
    loading: Boolean,
    errorMessage: String?,
    statusMessage: String,
    continueProgressByContentId: Map<String, Int>,
    onSearchCatalog: suspend (query: String, access: String, type: String) -> ApiResult<CatalogResponse>,
    onBack: () -> Unit,
    onOpenDetail: (ContentCard) -> Unit
) {
    BackHandler(onBack = onBack)

    val queryRequester = remember { FocusRequester() }
    var query by remember { mutableStateOf("") }
    var accessFilter by remember { mutableStateOf("all") }
    var typeFilter by remember { mutableStateOf("all") }
    var remoteResults by remember { mutableStateOf<List<ContentCard>>(emptyList()) }
    var remoteTotal by remember { mutableIntStateOf(0) }
    var remoteLoading by remember { mutableStateOf(false) }
    var remoteError by remember { mutableStateOf<String?>(null) }

    val localCatalog = remember(rows) {
        buildList {
            val seen = mutableSetOf<String>()
            rows.forEach { row ->
                row.items.forEach { item ->
                    if (seen.add(item.id)) add(item)
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        queryRequester.requestFocus()
    }

    LaunchedEffect(query, accessFilter, typeFilter) {
        if (loading && rows.isEmpty()) return@LaunchedEffect
        remoteLoading = true
        remoteError = null
        delay(250)
        when (val result = onSearchCatalog(query.trim(), accessFilter, typeFilter)) {
            is ApiResult.Success -> {
                remoteResults = result.value.items
                remoteTotal = result.value.total
                remoteError = null
            }

            is ApiResult.Error -> {
                remoteError = result.message
                remoteResults = emptyList()
                remoteTotal = 0
            }
        }
        remoteLoading = false
    }

    val results = if (remoteError == null) remoteResults else localCatalog
    val displayedCount = if (remoteError == null && remoteTotal > 0) remoteTotal else results.size

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Browse Catalog", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Text(
                    if ((loading && rows.isEmpty()) || remoteLoading) "Searching..." else "$displayedCount results",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFFB7C9D4)
                )
            }
            TvOutlinedButton(onClick = onBack) { Text("Back") }
        }

        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier.fillMaxWidth().focusRequester(queryRequester),
            label = { Text("Search titles, tags, synopsis") },
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                unfocusedBorderColor = Color(0x55B7C9D4),
                focusedBorderColor = Color(0xFFA6EEFF),
                cursorColor = Color(0xFFA6EEFF)
            )
        )

        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                TvFilterChip(
                    label = "All",
                    selected = accessFilter == "all",
                    onClick = { accessFilter = "all" }
                )
            }
            item {
                TvFilterChip(
                    label = "Subscriber",
                    selected = accessFilter == "premium",
                    onClick = { accessFilter = "premium" }
                )
            }
            item {
                TvFilterChip(
                    label = "Free",
                    selected = accessFilter == "free",
                    onClick = { accessFilter = "free" }
                )
            }
            item { Spacer(Modifier.width(8.dp)) }
            item {
                TvFilterChip(
                    label = "Any Type",
                    selected = typeFilter == "all",
                    onClick = { typeFilter = "all" }
                )
            }
            listOf("film", "series", "episode", "trailer", "bonus").forEach { type ->
                item {
                    TvFilterChip(
                        label = type.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() },
                        selected = typeFilter == type,
                        onClick = { typeFilter = type }
                    )
                }
            }
        }

        if (errorMessage != null && rows.isEmpty()) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color(0x33A61D24),
                tonalElevation = 2.dp
            ) {
                Text(
                    "Search unavailable: $errorMessage",
                    modifier = Modifier.padding(16.dp),
                    color = Color(0xFFFFD7D9)
                )
            }
        } else if (loading && rows.isEmpty()) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color(0x220C1F29),
                tonalElevation = 2.dp
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(statusMessage.ifBlank { "Loading catalog..." }, color = Color(0xFFDDE8EE))
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = Color(0xFF57D7FF))
                }
            }
        } else if (remoteError != null) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color(0x332E4E61),
                tonalElevation = 2.dp
            ) {
                Text(
                    "Server search unavailable ($remoteError). Showing local rows only.",
                    modifier = Modifier.padding(16.dp),
                    color = Color(0xFFD7F2FF)
                )
            }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(results) { item ->
                    SearchResultCard(
                        item = item,
                        progressPercent = continueProgressByContentId[item.id],
                        onOpen = { onOpenDetail(item) }
                    )
                }
            }
        } else if (!remoteLoading && results.isEmpty()) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color(0x220C1F29),
                tonalElevation = 2.dp
            ) {
                Text(
                    "No matching titles. Try a different search term.",
                    modifier = Modifier.padding(16.dp),
                    color = Color(0xFFDDE8EE)
                )
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(results) { item ->
                    SearchResultCard(
                        item = item,
                        progressPercent = continueProgressByContentId[item.id],
                        onOpen = { onOpenDetail(item) }
                    )
                }
            }
        }
    }
}

@Composable
private fun TvFilterChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    val scale by animateFloatAsState(if (focused) 1.03f else 1f, label = "chipScale")

    Surface(
        modifier = Modifier
            .scale(scale)
            .onFocusChanged { }
            .focusable(interactionSource = interactionSource)
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick),
        shape = RoundedCornerShape(999.dp),
        color = when {
            focused && selected -> Color(0xFF118FBA)
            focused -> Color(0x333E93AC)
            selected -> Color(0x223E93AC)
            else -> Color(0x220C1F29)
        },
        border = androidx.compose.foundation.BorderStroke(
            width = if (focused) 2.dp else 1.dp,
            color = when {
                focused -> Color(0xFFA6EEFF)
                selected -> Color(0x6657D7FF)
                else -> Color(0x33FFFFFF)
            }
        )
    ) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            color = Color(0xFFEAF8FD),
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

@Composable
private fun SearchResultCard(
    item: ContentCard,
    progressPercent: Int?,
    onOpen: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (isFocused) 1.01f else 1f, label = "searchCardScale")

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(120.dp)
            .scale(scale)
            .clip(RoundedCornerShape(12.dp))
            .onFocusChanged { isFocused = it.isFocused }
            .focusable()
            .clickable(onClick = onOpen)
            .background(if (isFocused) Color(0x333E93AC) else Color(0x220C1F29))
            .border(
                width = if (isFocused) 2.dp else 1.dp,
                color = if (isFocused) Color(0xFFA6EEFF) else Color(0x33FFFFFF),
                shape = RoundedCornerShape(12.dp)
            )
            .padding(10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            modifier = Modifier
                .width(160.dp)
                .fillMaxHeight()
                .clip(RoundedCornerShape(10.dp))
                .background(Color(0x220C1F29))
        ) {
            AsyncImage(
                model = item.posterUrl.takeIf { it.isNotBlank() },
                contentDescription = item.title,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(item.title, style = MaterialTheme.typography.titleMedium, maxLines = 2)
            Text(
                "${item.type} | ${item.releaseYear ?: "n/a"} | ${item.durationSeconds / 60} min | ${if (item.isPremium) "Subscriber only" else "Free"}",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFFB7C9D4)
            )
            Text(item.synopsis, style = MaterialTheme.typography.bodySmall, color = Color(0xFFDDE8EE), maxLines = 2)
            if ((progressPercent ?: 0) > 0) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Progress ${progressPercent}%", style = MaterialTheme.typography.bodySmall, color = Color(0xFFB7C9D4))
                    LinearProgressIndicator(
                        progress = { (progressPercent!!.coerceIn(0, 100)) / 100f },
                        modifier = Modifier.fillMaxWidth().height(4.dp),
                        color = Color(0xFF57D7FF),
                        trackColor = Color(0x553A5563)
                    )
                }
            }
        }
    }
}

@Composable
private fun DetailScreen(
    item: ContentCard,
    progress: ViewerProgressResponse?,
    isLoadingProgress: Boolean,
    loadError: String?,
    inMyList: Boolean,
    continueProgressPercent: Int?,
    onToggleMyList: (shouldAdd: Boolean) -> Unit,
    onBack: () -> Unit,
    onPlay: () -> Unit,
    onResume: () -> Unit,
    onRestart: () -> Unit
) {
    val canResume = progress?.hasProgress == true && !progress.completed && progress.positionSeconds > 0
    val playRequester = remember { FocusRequester() }
    val resumeRequester = remember { FocusRequester() }

    BackHandler(onBack = onBack)

    LaunchedEffect(item.id, canResume) {
        if (canResume) {
            resumeRequester.requestFocus()
        } else {
            playRequester.requestFocus()
        }
    }

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(item.title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Text(
                    "${item.type} | ${item.releaseYear ?: "n/a"} | ${item.durationSeconds / 60} min",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFFB7C9D4)
                )
                Text(
                    if (item.isPremium) "Subscriber only" else "Free to watch",
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (item.isPremium) Color(0xFFFFD29D) else Color(0xFF9BE8D5)
                )
            }
            TvOutlinedButton(onClick = onBack) { Text("Back") }
        }

        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color(0x220C1F29),
            tonalElevation = 2.dp
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Box(
                    modifier = Modifier
                        .width(220.dp)
                        .height(320.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0x220C1F29))
                ) {
                    AsyncImage(
                        model = item.posterUrl.takeIf { it.isNotBlank() },
                        contentDescription = item.title,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                }

                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (isLoadingProgress) {
                        Text("Loading playback progress...", style = MaterialTheme.typography.bodyMedium, color = Color(0xFFB7C9D4))
                        LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = Color(0xFF57D7FF))
                    } else if (loadError != null) {
                        Surface(color = Color(0x33A61D24)) {
                            Text(
                                "Could not load saved progress: $loadError",
                                modifier = Modifier.padding(10.dp),
                                color = Color(0xFFFFD7D9),
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }

                    Text(item.synopsis, style = MaterialTheme.typography.bodyLarge, color = Color(0xFFDDE8EE))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (inMyList) {
                            TvOutlinedButton(onClick = { onToggleMyList(false) }) { Text("Remove from My List") }
                        } else {
                            TvOutlinedButton(onClick = { onToggleMyList(true) }) { Text("Add to My List") }
                        }
                    }
                    if ((continueProgressPercent ?: 0) > 0) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                "Continue Watching progress: ${continueProgressPercent}%",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color(0xFFB7C9D4)
                            )
                            LinearProgressIndicator(
                                progress = { (continueProgressPercent!!.coerceIn(0, 100)) / 100f },
                                modifier = Modifier.fillMaxWidth().height(6.dp),
                                color = Color(0xFF57D7FF),
                                trackColor = Color(0x553A5563)
                            )
                        }
                    }

                    if (canResume && progress != null) {
                        Text(
                            "Saved progress: ${progress.progressPercent}% at ${progress.positionSeconds / 60}:${(progress.positionSeconds % 60).toString().padStart(2, '0')}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFFB7C9D4)
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            TvButton(onClick = onPlay, modifier = Modifier.focusRequester(playRequester)) { Text("Play") }
                            TvButton(onClick = onResume, modifier = Modifier.focusRequester(resumeRequester)) { Text("Resume") }
                            TvOutlinedButton(onClick = onRestart) { Text("Restart") }
                        }
                    } else {
                        TvButton(onClick = onPlay, modifier = Modifier.focusRequester(playRequester)) { Text("Play") }
                    }
                }
            }
        }
    }
}

@Composable
private fun PlayerScreen(
    contentId: String,
    title: String,
    playbackUrl: String,
    durationSeconds: Int,
    resumePositionSeconds: Int,
    onProgress: (contentId: String, positionSeconds: Int, durationSeconds: Int, completed: Boolean) -> Unit,
    onRetry: () -> Unit,
    onBack: () -> Unit
) {
    BackHandler(onBack = onBack)
    val context = LocalContext.current
    var playerError by remember(playbackUrl) { mutableStateOf<String?>(null) }
    var lastReportedPosition by remember(playbackUrl) { mutableIntStateOf(0) }
    var durationHint by remember(playbackUrl) { mutableIntStateOf(durationSeconds) }
    var initialSeekApplied by remember(playbackUrl) { mutableStateOf(false) }
    val player = remember(playbackUrl) {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(playbackUrl))
            prepare()
            playWhenReady = true
        }
    }

    LaunchedEffect(player) {
        while (true) {
            delay(15000)
            val pos = (player.currentPosition / 1000L).toInt().coerceAtLeast(0)
            val dur = if (player.duration > 0) (player.duration / 1000L).toInt() else durationHint
            if (pos > 0 && pos != lastReportedPosition) {
                lastReportedPosition = pos
                durationHint = dur
                onProgress(contentId, pos, dur, false)
            }
        }
    }

    DisposableEffect(player, resumePositionSeconds) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_READY && !initialSeekApplied) {
                    playerError = null
                    if (resumePositionSeconds > 0) {
                        player.seekTo(((resumePositionSeconds.coerceAtLeast(0) - 2).coerceAtLeast(0)) * 1000L)
                        lastReportedPosition = resumePositionSeconds
                    }
                    initialSeekApplied = true
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (!isPlaying) {
                    val pos = (player.currentPosition / 1000L).toInt().coerceAtLeast(0)
                    val dur = if (player.duration > 0) (player.duration / 1000L).toInt() else durationHint
                    if (pos > 0) {
                        lastReportedPosition = pos
                        durationHint = dur
                        onProgress(contentId, pos, dur, false)
                    }
                }
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                playerError = error.message ?: "Playback error"
            }
        }

        player.addListener(listener)
        onDispose {
            val pos = (player.currentPosition / 1000L).toInt().coerceAtLeast(0)
            val dur = if (player.duration > 0) (player.duration / 1000L).toInt() else durationHint
            val completed = dur > 0 && pos >= (dur - 15).coerceAtLeast(1)
            if (pos > 0) {
                onProgress(contentId, pos, dur, completed)
            }
            player.removeListener(listener)
            player.release()
        }
    }

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            Text("Playing: $title", style = MaterialTheme.typography.titleLarge)
            TvOutlinedButton(onClick = onBack) { Text("Back") }
        }
        if (resumePositionSeconds > 0) {
            Text(
                "Resuming at ${resumePositionSeconds / 60}:${(resumePositionSeconds % 60).toString().padStart(2, '0')}",
                style = MaterialTheme.typography.bodyMedium,
                color = Color(0xFFB7C9D4)
            )
        }
        if (playerError != null) {
            Surface(color = Color(0x33A61D24), modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.padding(10.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "Player error: $playerError",
                        color = Color(0xFFFFD7D9),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(Modifier.width(12.dp))
                    TvOutlinedButton(onClick = onRetry) {
                        Text("Retry")
                    }
                }
            }
        }
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                PlayerView(ctx).apply { this.player = player }
            },
            update = { it.player = player }
        )
    }
}

@Composable
private fun TvButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable RowScope.() -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    val scale by animateFloatAsState(if (focused) 1.04f else 1f, label = "tvButtonScale")
    Button(
        onClick = onClick,
        modifier = modifier.scale(scale),
        interactionSource = interactionSource,
        colors = ButtonDefaults.buttonColors(
            containerColor = if (focused) Color(0xFF11A8D6) else Color(0xFF0A7EA4),
            contentColor = Color.White
        ),
        content = content
    )
}

@Composable
private fun TvOutlinedButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable RowScope.() -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    val scale by animateFloatAsState(if (focused) 1.04f else 1f, label = "tvOutlinedScale")
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.scale(scale),
        interactionSource = interactionSource,
        border = androidx.compose.foundation.BorderStroke(
            width = if (focused) 2.dp else 1.dp,
            color = if (focused) Color(0xFFA6EEFF) else Color(0x55B7C9D4)
        ),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = if (focused) Color(0x223E93AC) else Color.Transparent,
            contentColor = Color(0xFFEAF8FD)
        ),
        content = content
    )
}
