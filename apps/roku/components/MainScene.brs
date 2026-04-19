function Flyhigh_GetConfig() as Object
    return {
        apiBaseUrl: "https://api.flyhigh.tv"
        webActivateBaseUrl: "https://app.flyhigh.tv"
        appName: "roku-beta"
    }
end function

sub init()
    m.config = Flyhigh_GetConfig()

    m.headerLabel = m.top.findNode("headerLabel")
    m.statusLabel = m.top.findNode("statusLabel")
    m.hintLabel = m.top.findNode("hintLabel")
    m.authShortcutLabel = m.top.findNode("authShortcutLabel")
    m.navHomeBg = m.top.findNode("navHomeBg")
    m.navHomeLabel = m.top.findNode("navHomeLabel")
    m.navSearchBg = m.top.findNode("navSearchBg")
    m.navSearchLabel = m.top.findNode("navSearchLabel")
    m.navMyListBg = m.top.findNode("navMyListBg")
    m.navMyListLabel = m.top.findNode("navMyListLabel")
    m.navAccountBg = m.top.findNode("navAccountBg")
    m.navAccountLabel = m.top.findNode("navAccountLabel")
    m.signInButtonGroup = m.top.findNode("signInButtonGroup")
    m.signInButtonBg = m.top.findNode("signInButtonBg")
    m.signInButtonLabel = m.top.findNode("signInButtonLabel")
    m.debugLabel = m.top.findNode("debugLabel")
    m.debugItemsLabel = m.top.findNode("debugItemsLabel")
    m.heroPanel = m.top.findNode("heroPanel")
    m.heroPoster = m.top.findNode("heroPoster")
    m.heroPreviewVideo = m.top.findNode("heroPreviewVideo")
    m.heroTitle = m.top.findNode("heroTitle")
    m.heroMeta = m.top.findNode("heroMeta")
    m.heroSynopsis = m.top.findNode("heroSynopsis")
    m.heroDots = m.top.findNode("heroDots")
    m.rowList = m.top.findNode("homeRows")

    m.detailTitle = m.top.findNode("detailTitle")
    m.detailMeta = m.top.findNode("detailMeta")
    m.detailSynopsis = m.top.findNode("detailSynopsis")
    m.detailVideoStatus = m.top.findNode("detailVideoStatus")
    m.detailAuthStatus = m.top.findNode("detailAuthStatus")
    m.detailAction = m.top.findNode("detailAction")

    m.authPanel = m.top.findNode("authPanel")
    m.authCodeLabel = m.top.findNode("authCodeLabel")
    m.authUrlLabel = m.top.findNode("authUrlLabel")
    m.authStatusLabel = m.top.findNode("authStatusLabel")
    m.authCloseHint = m.top.findNode("authCloseHint")
    m.pollTimer = m.top.findNode("pollTimer")
    m.deviceStartTimeoutTimer = m.top.findNode("deviceStartTimeoutTimer")
    m.heroTimer = m.top.findNode("heroTimer")
    m.heroPreviewDelayTimer = m.top.findNode("heroPreviewDelayTimer")
    m.videoPlayer = m.top.findNode("videoPlayer")

    m.homeTask = m.top.findNode("homeTask")
    m.continueWatchingTask = m.top.findNode("continueWatchingTask")
    m.myListTask = m.top.findNode("myListTask")
    m.myListToggleTask = m.top.findNode("myListToggleTask")
    m.deviceStartTask = m.top.findNode("deviceStartTask")
    m.devicePollTask = m.top.findNode("devicePollTask")
    m.playbackTask = m.top.findNode("playbackTask")
    m.searchTask = m.top.findNode("searchTask")

    m.baseRows = []
    m.homeFeedRows = []
    m.homeHeroItems = []
    m.feedRows = []
    m.continueWatchingItems = []
    m.myListItems = []
    m.myListIds = CreateObject("roAssociativeArray")
    m.currentItem = invalid
    m.homeLoadFailed = false
    m.playbackFailed = false
    m.deviceLoginId = ""
    m.deviceCode = ""
    m.devicePollInFlight = false
    m.authFlowActive = false
    m.deviceAccessToken = loadDeviceToken()
    m.heroItems = []
    m.heroIndex = 0
    m.currentBrowseMode = "home"
    m.searchQuery = ""
    m.searchDialog = invalid
    m.launchCompleteSent = false
    m.dialogBeaconOpenCount = 0
    m.primaryFocusZone = "rows"
    m.navIndex = 0
    m.navRows = ["search", "home", "my-list", "account"]

    setupTask(m.homeTask, "onHomeTaskResponse", "onHomeTaskError")
    setupTask(m.continueWatchingTask, "onContinueWatchingTaskResponse", "onContinueWatchingTaskError")
    setupTask(m.myListTask, "onMyListTaskResponse", "onMyListTaskError")
    setupTask(m.myListToggleTask, "onMyListToggleTaskResponse", "onMyListToggleTaskError")
    setupTask(m.deviceStartTask, "onDeviceStartTaskResponse", "onDeviceStartTaskError")
    setupTask(m.devicePollTask, "onDevicePollTaskResponse", "onDevicePollTaskError")
    setupTask(m.playbackTask, "onPlaybackTaskResponse", "onPlaybackTaskError")
    setupTask(m.searchTask, "onSearchTaskResponse", "onSearchTaskError")

    m.rowList.observeField("rowItemFocused", "onRowItemFocused")
    m.rowList.observeField("rowItemSelected", "onRowItemSelected")
    m.deviceStartTask.observeField("state", "onDeviceStartTaskState")
    m.pollTimer.observeField("fire", "onPollTimerFire")
    m.deviceStartTimeoutTimer.observeField("fire", "onDeviceStartTimeout")
    m.heroTimer.observeField("fire", "onHeroTimerFire")
    m.heroPreviewDelayTimer.observeField("fire", "onHeroPreviewDelayFire")
    m.heroPreviewVideo.observeField("state", "onHeroPreviewVideoStateChanged")
    m.videoPlayer.observeField("state", "onVideoStateChanged")

    m.top.setFocus(true)
    m.rowList.setFocus(true)

    if m.deviceAccessToken <> "" then
        m.detailAuthStatus.text = "TV session token loaded"
    else
        m.detailAuthStatus.text = "Not signed in on TV (press *)"
    end if
    refreshAuthCopy()
    renderNavigation()
    m.debugLabel.text = "Flyhigh Roku Beta mounted"

    loadHomeFeed()
end sub

sub setupTask(task as Object, responseHandler as String, errorHandler as String)
    task.apiBaseUrl = m.config.apiBaseUrl
    task.observeField("response", responseHandler)
    task.observeField("errorMessage", errorHandler)
end sub

sub loadHomeFeed()
    m.statusLabel.text = "Loading home feed..."
    runTask(m.homeTask, "/v1/content/home", "GET", invalid, "", "home")
end sub

sub loadMyList()
    if m.deviceAccessToken = invalid or m.deviceAccessToken = "" then
        clearMyListRow()
        return
    end if
    runTask(m.myListTask, "/v1/viewer/my-list", "GET", invalid, m.deviceAccessToken, "my-list")
end sub

sub loadContinueWatching()
    if m.deviceAccessToken = invalid or m.deviceAccessToken = "" then
        m.continueWatchingItems = []
        rebuildPersonalizedRows()
        return
    end if
    runTask(m.continueWatchingTask, "/v1/viewer/continue-watching", "GET", invalid, m.deviceAccessToken, "continue-watching")
end sub

sub runTask(task as Object, path as String, method = "GET" as String, body = invalid as Dynamic, authToken = "" as String, requestTag = "" as String)
    task.control = "STOP"
    task.apiBaseUrl = m.config.apiBaseUrl
    task.path = path
    task.method = method
    task.body = body
    task.bodyJson = "{}"
    if body <> invalid then
        bodyType = type(body)
        if bodyType = "roString" or bodyType = "String" then
            task.bodyJson = body
        else
            task.bodyJson = FormatJson(body)
        end if
    end if
    task.authToken = authToken
    task.requestTag = requestTag
    task.control = "RUN"
end sub

sub onHomeTaskResponse()
    res = m.homeTask.response
    if res = invalid then return

    rows = []
    if res.rows <> invalid then rows = res.rows

    featuredItems = []
    if res.featuredItems <> invalid then
        featuredItems = res.featuredItems
    else if res.featured <> invalid then
        featuredItems = [res.featured]
    end if

    m.homeHeroItems = featuredItems
    setHeroItems(featuredItems)

    m.baseRows = rows
    m.homeFeedRows = rows
    m.feedRows = rows
    m.currentBrowseMode = "home"
    m.homeLoadFailed = false

    renderRows()
    m.debugLabel.text = "Home rows: " + rows.Count().ToStr() + " | Feed rows: " + m.feedRows.Count().ToStr()
    if featuredItems.Count() > 0 then
        m.debugItemsLabel.text = "Featured: " + safeToString(featuredItems[0].title)
    else
        m.debugItemsLabel.text = "No featured item returned"
    end if
    if rows.Count() > 0 and rows[0].items <> invalid and rows[0].items.Count() > 0 then
        m.debugItemsLabel.text = m.debugItemsLabel.text + " | " + rows[0].title + ": " + safeToString(rows[0].items[0].title)
    else
        m.debugItemsLabel.text = m.debugItemsLabel.text + " | No row items returned"
    end if

    if m.deviceAccessToken <> "" then
        loadContinueWatching()
        loadMyList()
    else
        m.continueWatchingItems = []
        rebuildPersonalizedRows()
    end if

    focused = m.rowList.rowItemFocused
    if focused = invalid then
        showDetailFromIndexes([0, 0])
    else
        showDetailFromIndexes(focused)
    end if

    signalLaunchCompleteIfNeeded()
end sub

sub renderRows()
    root = CreateObject("roSGNode", "ContentNode")
    for each row in m.feedRows
        rowNode = CreateObject("roSGNode", "ContentNode")
        rowNode.title = safeToString(row.title)

        items = []
        if row.items <> invalid then items = row.items
        for each item in items
            itemNode = CreateObject("roSGNode", "ContentNode")
            itemNode.AddField("contentId", "string", false)
            itemNode.AddField("slug", "string", false)
            itemNode.AddField("synopsis", "string", false)
            itemNode.AddField("isPremium", "boolean", false)
            itemNode.AddField("videoStatus", "string", false)
            itemNode.AddField("releaseYear", "string", false)
            itemNode.AddField("durationMinutes", "string", false)
            itemNode.AddField("specialAction", "string", false)
            itemNode.AddField("previewUrl", "string", false)
            itemNode.title = safeToString(item.title)
            itemNode.shortDescriptionLine1 = ""
            yearLabel = getReleaseYearLabel(item)
            durationLabel = getDurationMinutesLabel(item)
            metaLine = safeToString(item.type) + " | " + yearLabel + " | " + durationLabel + " min"
            if safeToString(item.specialAction) = "sign-in" then
                metaLine = "Account | Activate this TV"
            else if safeToString(item.specialAction) = "account" then
                metaLine = "Account | Signed in"
            end if
            itemNode.shortDescriptionLine2 = metaLine
            itemNode.hdPosterUrl = getPosterUrl(item)
            itemNode.contentId = item.id
            itemNode.slug = item.slug
            itemNode.synopsis = item.synopsis
            itemNode.isPremium = item.isPremium
            itemNode.releaseYear = yearLabel
            itemNode.durationMinutes = durationLabel
            itemNode.specialAction = safeToString(item.specialAction)
            itemNode.previewUrl = getPreviewUrl(item)
            rowNode.AppendChild(itemNode)
        end for

        root.AppendChild(rowNode)
    end for

    m.rowList.content = root
end sub

sub setHeroItems(items as Object)
    if items = invalid then items = []
    m.heroItems = items
    m.heroIndex = 0
    renderHero()
    if m.heroItems.Count() > 1 then
        m.heroTimer.control = "start"
    else
        m.heroTimer.control = "stop"
    end if
end sub

sub renderHero()
    if m.heroItems = invalid or m.heroItems.Count() = 0 then
        m.heroPanel.visible = false
        return
    end if

    m.heroPanel.visible = true
    if m.heroIndex < 0 then m.heroIndex = 0
    if m.heroIndex >= m.heroItems.Count() then m.heroIndex = 0
    item = m.heroItems[m.heroIndex]

    m.heroPoster.uri = getPosterUrl(item)
    scheduleHeroPreview(item)
    m.heroTitle.text = safeToString(item.title)
    yearLabel = getReleaseYearLabel(item)
    durationMin = getDurationMinutesLabel(item)
    m.heroMeta.text = safeToString(item.type) + " | " + yearLabel + " | " + durationMin + " min"
    m.heroSynopsis.text = safeToString(item.synopsis)
    m.heroDots.text = (m.heroIndex + 1).ToStr() + "/" + m.heroItems.Count().ToStr() + "  -  OK to play selected title"
end sub

sub renderHeroForItem(item as Object)
    if item = invalid then return
    if safeToString(item.specialAction) <> "" then return

    m.heroTimer.control = "stop"
    m.heroPanel.visible = true
    m.heroPoster.uri = getPosterUrl(item)
    scheduleHeroPreview(item)
    m.heroTitle.text = safeToString(item.title)
    m.heroMeta.text = safeToString(item.type) + " | " + getReleaseYearLabel(item) + " | " + getDurationMinutesLabel(item) + " min"
    m.heroSynopsis.text = safeToString(item.synopsis)

    premiumLabel = "Free"
    if item.isPremium = true then premiumLabel = "Subscriber"
    m.heroDots.text = premiumLabel + "  -  OK to play"
end sub

sub onHeroTimerFire()
    if m.heroItems = invalid or m.heroItems.Count() <= 1 then return
    m.heroIndex = (m.heroIndex + 1) mod m.heroItems.Count()
    renderHero()
end sub

sub scheduleHeroPreview(item as Object)
    stopHeroPreview()
    previewUrl = getPreviewUrl(item)
    if previewUrl = "" then return
    m.heroPreviewDelayTimer.control = "start"
end sub

sub stopHeroPreview()
    m.heroPreviewDelayTimer.control = "stop"
    if m.heroPreviewVideo <> invalid then
        m.heroPreviewVideo.control = "stop"
        m.heroPreviewVideo.visible = false
        m.heroPreviewVideo.content = invalid
    end if
end sub

sub onHeroPreviewDelayFire()
    if m.currentItem = invalid then return
    previewUrl = getPreviewUrl(m.currentItem)
    if previewUrl = "" then return

    content = CreateObject("roSGNode", "ContentNode")
    content.title = safeToString(m.currentItem.title)
    content.url = previewUrl
    content.streamFormat = "hls"

    m.heroPreviewVideo.visible = true
    m.heroPreviewVideo.content = content
    m.heroPreviewVideo.control = "play"
end sub

sub onHeroPreviewVideoStateChanged()
    state = LCase(safeToString(m.heroPreviewVideo.state))
    if state = "error" or state = "stopped" then
        m.heroPreviewVideo.visible = false
    else if state = "finished" then
        if m.heroPreviewVideo.content <> invalid then
            m.heroPreviewVideo.control = "play"
        end if
    end if
end sub

sub onHomeTaskError()
    if m.homeTask.errorMessage = invalid or m.homeTask.errorMessage = "" then return
    m.homeLoadFailed = true
    m.statusLabel.text = "Home feed error: " + m.homeTask.errorMessage
    m.debugLabel.text = "Home feed failed"
    m.debugItemsLabel.text = m.homeTask.errorMessage
    m.hintLabel.text = "Replay: Retry home feed    OK: Play    Play/Pause: My List    *: TV Sign-in"
    signalLaunchCompleteIfNeeded()
end sub

sub rebuildPersonalizedRows()
    nextRows = []

    if m.continueWatchingItems <> invalid and m.continueWatchingItems.Count() > 0 then
        nextRows.Push({
            id: "continue-watching"
            title: "Continue Watching"
            items: m.continueWatchingItems
        })
    end if

    if m.myListItems <> invalid and m.myListItems.Count() > 0 then
        nextRows.Push({
            id: "my-list"
            title: "My List"
            items: m.myListItems
        })
    end if

    for each row in m.baseRows
        nextRows.Push(row)
    end for

    m.homeFeedRows = nextRows
    if m.currentBrowseMode = "home" then
        m.feedRows = nextRows
        renderRows()
    end if
end sub

sub openSearchDialog()
    stopHeroPreview()
    if m.searchDialog <> invalid then
        m.searchDialog.close = true
    end if

    dialog = CreateObject("roSGNode", "StandardKeyboardDialog")
    dialog.title = "Search Flyhigh"
    dialog.buttons = ["Search", "Cancel"]
    dialog.text = ""
    dialog.observeField("buttonSelected", "onSearchDialogButtonSelected")

    scene = m.top.getScene()
    signalDialogInitiate()
    scene.dialog = dialog
    m.searchDialog = dialog
end sub

sub onSearchDialogButtonSelected()
    if m.searchDialog = invalid then return

    selectedIndex = m.searchDialog.buttonSelected
    query = safeToString(m.searchDialog.text).Trim()
    m.searchDialog.close = true
    m.searchDialog = invalid
    signalDialogComplete()

    if selectedIndex <> 0 then
        m.searchQuery = ""
        showNavigationDetail()
        return
    end if

    if Len(query) < 2 then
        m.searchQuery = ""
        m.statusLabel.text = "Enter at least 2 characters to search"
        m.detailTitle.text = "Search"
        m.detailMeta.text = "Need a little more text"
        m.detailSynopsis.text = "Use 2 or more letters so Roku can find titles, tags, authors, and descriptions."
        m.detailVideoStatus.text = "Navigation"
        m.detailAuthStatus.text = getAuthStatusLabel()
        m.detailAction.text = "OK: search again"
        return
    end if

    executeSearch(query)
end sub

sub executeSearch(query as String)
    m.searchQuery = query
    m.currentBrowseMode = "search"
    m.statusLabel.text = "Searching for " + query + "..."
    m.detailTitle.text = "Search"
    m.detailMeta.text = "Looking for " + query
    m.detailSynopsis.text = "Search is checking titles, synopses, tags, and authors."
    m.detailVideoStatus.text = "Navigation"
    m.detailAuthStatus.text = getAuthStatusLabel()
    m.detailAction.text = "Please wait..."

    encodedQuery = urlEncode(query)
    runTask(m.searchTask, "/v1/content/catalog?q=" + encodedQuery + "&limit=48&sort=featured", "GET", invalid, "", "search")
end sub

sub onSearchTaskResponse()
    res = m.searchTask.response
    if res = invalid then return

    items = []
    if res.items <> invalid then items = res.items

    m.currentBrowseMode = "search"
    if items.Count() = 0 then
        m.feedRows = []
        setHeroItems([])
        renderRows()
        exitNavigation()
        m.currentItem = invalid
        m.statusLabel.text = "No results found"
        m.detailTitle.text = "No results"
        m.detailMeta.text = "Search"
        m.detailSynopsis.text = "We could not find any titles for " + Chr(34) + m.searchQuery + Chr(34) + ". Try a shorter or broader search."
        m.detailVideoStatus.text = "Search"
        m.detailAuthStatus.text = getAuthStatusLabel()
        m.detailAction.text = "OK on Search: try again"
        return
    end if

    m.feedRows = [{
        id: "search-results"
        title: "Results for " + Chr(34) + m.searchQuery + Chr(34)
        items: items
    }]
    setHeroItems(items)
    renderRows()
    exitNavigation()
    m.statusLabel.text = "Found " + items.Count().ToStr() + " results"
    showDetailFromIndexes([0, 0])
    renderHeroForItem(m.currentItem)
    m.rowList.jumpToRowItem = [0, 0]
    m.rowList.setFocus(true)
end sub

sub onSearchTaskError()
    if m.searchTask.errorMessage = invalid or m.searchTask.errorMessage = "" then return
    exitNavigation()
    m.statusLabel.text = "Search error: " + m.searchTask.errorMessage
    m.detailTitle.text = "Search error"
    m.detailMeta.text = "Search"
    m.detailSynopsis.text = "We could not load search results right now. Please try again."
    m.detailVideoStatus.text = "Search"
    m.detailAuthStatus.text = getAuthStatusLabel()
    m.detailAction.text = "OK on Search: try again"
end sub

sub showHomeBrowse()
    m.currentBrowseMode = "home"
    m.searchQuery = ""
    m.feedRows = m.homeFeedRows
    setHeroItems(m.homeHeroItems)
    renderRows()
    if m.feedRows <> invalid and m.feedRows.Count() > 0 then
        m.rowList.jumpToRowItem = [0, 0]
        showDetailFromIndexes([0, 0])
        renderHeroForItem(m.currentItem)
    end if
    m.statusLabel.text = "Browse ready"
end sub

sub onRowItemFocused()
    if m.primaryFocusZone <> "rows" then return
    idx = m.rowList.rowItemFocused
    if idx = invalid then return
    showDetailFromIndexes(idx)
    renderHeroForItem(m.currentItem)
end sub

sub onRowItemSelected()
    if m.primaryFocusZone <> "rows" then return
    idx = m.rowList.rowItemSelected
    if idx = invalid then idx = m.rowList.rowItemFocused
    if idx = invalid then return
    showDetailFromIndexes(idx)
    attemptPlayback(m.currentItem)
end sub

sub showDetailFromIndexes(idx as Object)
    item = getItemAtIndexes(idx)
    if item = invalid then return
    m.currentItem = item

    title = safeToString(item.title)
    specialAction = safeToString(item.specialAction)
    releaseYear = getReleaseYearLabel(item)
    durationMin = getDurationMinutesLabel(item)

    m.detailTitle.text = title
    if specialAction = "sign-in" then
        m.detailMeta.text = "Account | Activate this TV"
    else if specialAction = "account" then
        m.detailMeta.text = "Account | Signed in"
    else
        m.detailMeta.text = safeToString(item.type) + " | " + releaseYear + " | " + durationMin + " min"
    end if
    m.detailSynopsis.text = safeToString(item.synopsis)
    premiumLabel = "Free"
    if item.isPremium = true then premiumLabel = "Subscriber only"
    if specialAction = "sign-in" then
        m.detailVideoStatus.text = "Status: Sign in recommended"
    else if specialAction = "account" then
        m.detailVideoStatus.text = "Status: TV linked"
    else
        m.detailVideoStatus.text = "Visibility: " + premiumLabel
    end if
    if m.deviceAccessToken <> "" then
        m.detailAuthStatus.text = "TV signed in"
    else
        m.detailAuthStatus.text = "TV not signed in (press * to activate)"
    end if

    if specialAction = "sign-in" then
        m.detailAction.text = "Press OK to open the sign-in code screen"
    else if specialAction = "account" then
        m.detailAction.text = "Press OK to refresh TV sign-in"
    else if m.deviceAccessToken = "" and item.isPremium = true then
        m.detailAction.text = "Press OK to sign in and play this title"
    else if isInMyList(safeToString(item.id)) then
        m.detailAction.text = "Press OK to play selected title | Play/Pause: Remove from My List"
    else
        m.detailAction.text = "Press OK to play selected title | Play/Pause: Add to My List"
    end if
end sub

function isInMyList(contentId as String) as Boolean
    if contentId = "" then return false
    if m.myListIds = invalid then return false
    return m.myListIds.DoesExist(contentId)
end function

function isPersonalizedRowId(rowId as String) as Boolean
    return rowId = "my-list" or rowId = "continue-watching" or rowId = "sign-in" or rowId = "account"
end function

function prependRow(rows as Object, row as Object) as Object
    mergedRows = [row]
    for each existingRow in rows
        mergedRows.Push(existingRow)
    end for
    return mergedRows
end function

sub clearMyListRow()
    m.myListIds = CreateObject("roAssociativeArray")
    m.myListItems = []
    rebuildPersonalizedRows()
end sub

sub upsertMyListRow(items as Object, title as String)
    if items = invalid then items = []

    idMap = CreateObject("roAssociativeArray")
    for each item in items
        if item <> invalid and item.id <> invalid then
            idMap[safeToString(item.id)] = true
        end if
    end for
    m.myListIds = idMap
    m.myListItems = items
    rebuildPersonalizedRows()
end sub

sub onMyListTaskResponse()
    res = m.myListTask.response
    if res = invalid then return

    title = "My List"
    if res.title <> invalid and safeToString(res.title) <> "" then title = safeToString(res.title)
    items = []
    if res.items <> invalid then items = res.items

    upsertMyListRow(items, title)
    showDetailFromIndexes(m.rowList.rowItemFocused)
end sub

sub onContinueWatchingTaskResponse()
    res = m.continueWatchingTask.response
    if res = invalid then return

    items = []
    if res.items <> invalid then items = res.items

    m.continueWatchingItems = items
    rebuildPersonalizedRows()
    showDetailFromIndexes(m.rowList.rowItemFocused)
end sub

sub onContinueWatchingTaskError()
    if m.continueWatchingTask.errorMessage = invalid or m.continueWatchingTask.errorMessage = "" then return
    m.statusLabel.text = "Continue Watching load error: " + m.continueWatchingTask.errorMessage
end sub

sub onMyListTaskError()
    if m.myListTask.errorMessage = invalid or m.myListTask.errorMessage = "" then return
    m.statusLabel.text = "My List load error: " + m.myListTask.errorMessage
end sub

sub toggleMyList(item as Object)
    if item = invalid then return
    if m.deviceAccessToken = invalid or m.deviceAccessToken = "" then
        m.statusLabel.text = "Sign in required for My List"
        beginDeviceLogin()
        return
    end if

    contentId = safeToString(item.id)
    if contentId = "" then return

    if isInMyList(contentId) then
        path = "/v1/viewer/my-list/" + contentId
        runTask(m.myListToggleTask, path, "DELETE", invalid, m.deviceAccessToken, "my-list-remove")
        m.statusLabel.text = "Removing from My List..."
    else
    bodyJson = "{""contentId"":""" + contentId + """}"
    runTask(m.myListToggleTask, "/v1/viewer/my-list", "POST", bodyJson, m.deviceAccessToken, "my-list-add")
        m.statusLabel.text = "Adding to My List..."
    end if
end sub

sub onMyListToggleTaskResponse()
    if m.myListToggleTask.statusCode >= 200 and m.myListToggleTask.statusCode < 300 then
        loadMyList()
        m.statusLabel.text = "My List updated"
    end if
end sub

sub onMyListToggleTaskError()
    if m.myListToggleTask.errorMessage = invalid or m.myListToggleTask.errorMessage = "" then return
    m.statusLabel.text = "My List update error: " + m.myListToggleTask.errorMessage
end sub

function getItemAtIndexes(idx as Object) as Dynamic
    if idx = invalid or idx.Count() < 2 then return invalid
    rowIndex = idx[0]
    itemIndex = idx[1]
    if rowIndex < 0 or rowIndex >= m.feedRows.Count() then return invalid
    row = m.feedRows[rowIndex]
    if row = invalid or row.items = invalid then return invalid
    if itemIndex < 0 or itemIndex >= row.items.Count() then return invalid
    return row.items[itemIndex]
end function

sub beginDeviceLogin()
    stopHeroPreview()
    m.primaryFocusZone = "rows"
    m.authFlowActive = true
    signalDialogInitiate()
    m.authPanel.visible = true
    m.rowList.setFocus(true)
    m.top.setFocus(true)
    renderNavigation()
    m.statusLabel.text = "Requesting TV activation code..."
    m.detailTitle.text = "Activate this TV"
    m.detailMeta.text = "Requesting code..."
    m.detailSynopsis.text = "Keep browsing if you want. When the code appears here, open the activation URL on your phone or computer."
    m.detailVideoStatus.text = "Account"
    m.detailAuthStatus.text = "Waiting for device code"
    m.detailAction.text = "Press Back to cancel sign-in"
    m.deviceLoginId = ""
    m.deviceCode = ""
    m.devicePollInFlight = false

    body = "{""clientName"":""" + m.config.appName + """}"
    m.deviceStartTimeoutTimer.control = "start"
    runTask(m.deviceStartTask, "/v1/device-auth/start", "POST", body, "", "device-start")
end sub

sub onDeviceStartTaskState()
    state = safeToString(m.deviceStartTask.state)
    if m.authFlowActive <> true then return
    if m.deviceCode <> "" then return
    if state <> "" then
        m.detailAuthStatus.text = "Device-code request state: " + state
    end if
end sub

sub closeAuthPanel()
    m.authPanel.visible = false
    m.authFlowActive = false
    m.pollTimer.control = "stop"
    m.deviceStartTimeoutTimer.control = "stop"
    signalDialogComplete()
    setPrimaryFocusZone("rows")
end sub

sub onDeviceStartTaskResponse()
    res = m.deviceStartTask.response
    if res = invalid then return
    m.deviceStartTimeoutTimer.control = "stop"
    m.authPanel.visible = true

    m.deviceLoginId = safeToString(res.deviceLoginId)
    m.deviceCode = safeToString(res.userCode)

    if m.deviceCode = "" or m.deviceLoginId = "" then
        m.detailAuthStatus.text = "Could not start device login"
        return
    end if

    m.authCodeLabel.text = m.deviceCode
    m.authUrlLabel.text = m.config.webActivateBaseUrl + "/activate"
    m.authStatusLabel.text = "On a phone/computer, open the URL and approve this code"
    m.statusLabel.text = "Activation code ready"
    m.detailTitle.text = "Activate this TV"
    m.detailMeta.text = "Code: " + m.deviceCode
    m.detailSynopsis.text = "Open " + m.config.webActivateBaseUrl + "/activate on your phone or computer, enter code " + m.deviceCode + ", then approve this Roku."
    m.detailVideoStatus.text = "Account"
    m.detailAuthStatus.text = "Waiting for approval..."
    m.detailAction.text = "Press Back to cancel sign-in"
    m.pollTimer.control = "start"
end sub

sub onDeviceStartTaskError()
    if m.deviceStartTask.errorMessage = invalid or m.deviceStartTask.errorMessage = "" then return
    m.deviceStartTimeoutTimer.control = "stop"
    m.authFlowActive = false
    m.detailAuthStatus.text = "Device login error: " + m.deviceStartTask.errorMessage
    m.statusLabel.text = "Device login error"
end sub

sub onDeviceStartTimeout()
    if m.authFlowActive <> true then return
    if m.deviceCode <> "" then return
    m.detailMeta.text = "Still requesting code..."
    m.detailAuthStatus.text = "No activation code yet. Press OK on Account to retry."
    m.detailAction.text = "You can keep browsing. Press OK on Account to request a fresh code."
    m.statusLabel.text = "Activation code request is taking longer than expected"
end sub

sub onPollTimerFire()
    if m.deviceLoginId = "" then return
    if m.devicePollInFlight then return
    if m.authFlowActive <> true then return

    m.devicePollInFlight = true
    body = "{""deviceLoginId"":""" + m.deviceLoginId + """}"
    runTask(m.devicePollTask, "/v1/device-auth/poll", "POST", body, "", "device-poll")
end sub

sub onDevicePollTaskResponse()
    res = m.devicePollTask.response
    m.devicePollInFlight = false
    if res = invalid then return

    status = LCase(safeToString(res.status))
    if status = "" then status = "pending"

    if status = "pending" then
        m.authStatusLabel.text = "Waiting for approval..."
        m.detailAuthStatus.text = "Waiting for approval..."
        return
    else if status = "approved" then
        token = safeToString(res.accessToken)
        if token <> "" then
            m.deviceAccessToken = token
            saveDeviceToken(token)
            m.detailAuthStatus.text = "TV signed in"
            refreshAuthCopy()

            viewerName = ""
            if res.viewer <> invalid and res.viewer.displayName <> invalid then
                viewerName = safeToString(res.viewer.displayName)
            end if

            if viewerName <> "" then
                m.authStatusLabel.text = "Approved for " + viewerName
            else
                m.authStatusLabel.text = "TV sign-in approved"
            end if

            m.pollTimer.control = "stop"
            m.authFlowActive = false
            m.authPanel.visible = false
            signalDialogComplete()
            m.statusLabel.text = "TV sign-in complete"
            m.detailAuthStatus.text = "TV signed in"
            setPrimaryFocusZone("rows")
            rebuildPersonalizedRows()
            loadContinueWatching()
            loadMyList()
        else
            m.detailAuthStatus.text = "Approval received without access token"
        end if
    else if status = "expired" then
        m.detailAuthStatus.text = "Code expired. Press OK on Account to request a new code."
        m.authFlowActive = false
        m.pollTimer.control = "stop"
    else if status = "denied" then
        m.detailAuthStatus.text = "Code denied. Press OK on Account to try again."
        m.authFlowActive = false
        m.pollTimer.control = "stop"
    else if status = "consumed" then
        m.detailAuthStatus.text = "Code already used. Press OK on Account for a new code."
        m.authFlowActive = false
        m.pollTimer.control = "stop"
    end if
end sub

sub onDevicePollTaskError()
    m.devicePollInFlight = false
    if m.devicePollTask.errorMessage = invalid or m.devicePollTask.errorMessage = "" then return
    m.detailAuthStatus.text = "Polling error: " + m.devicePollTask.errorMessage
end sub

sub enterNavigation()
    stopHeroPreview()
    m.primaryFocusZone = "nav"
    m.rowList.setFocus(false)
    m.top.setFocus(true)
    renderNavigation()
    showNavigationDetail()
end sub

sub exitNavigation()
    m.primaryFocusZone = "rows"
    renderNavigation()
    m.rowList.setFocus(true)
    focused = m.rowList.rowItemFocused
    if focused <> invalid then
        showDetailFromIndexes(focused)
    end if
end sub

sub renderNavigation()
    searchFocused = false
    homeFocused = false
    myListFocused = false
    accountFocused = false
    if m.primaryFocusZone = "nav" then
        searchFocused = m.navIndex = 0
        homeFocused = m.navIndex = 1
        myListFocused = m.navIndex = 2
        accountFocused = m.navIndex = 3
    end if

    paintNavItem(m.navSearchBg, m.navSearchLabel, searchFocused)
    paintNavItem(m.navHomeBg, m.navHomeLabel, homeFocused)
    paintNavItem(m.navMyListBg, m.navMyListLabel, myListFocused)
    paintNavItem(m.navAccountBg, m.navAccountLabel, accountFocused)

    if m.deviceAccessToken <> "" then
        m.navAccountLabel.text = "Sign Out"
    else
        m.navAccountLabel.text = "Sign In"
    end if
end sub

sub paintNavItem(bg as Object, label as Object, focused as Boolean)
    if focused then
        bg.color = "0xFFD54AFF"
        label.color = "0x07131AFF"
    else
        bg.color = "0x0C1F2900"
        label.color = "0xB8C6D1FF"
    end if
end sub

sub showNavigationDetail()
    navId = m.navRows[m.navIndex]
    if navId = "search" then
        m.detailTitle.text = "Search"
        m.detailMeta.text = "Find a title"
        if m.searchQuery <> "" then
            m.detailSynopsis.text = "Search for a title, tag, author, or keyword. Current query: " + Chr(34) + m.searchQuery + Chr(34) + "."
            m.detailAction.text = "OK: search again | Right: keep browsing"
        else
            m.detailSynopsis.text = "Search across Flyhigh titles, tags, authors, and descriptions."
            m.detailAction.text = "OK: open search keyboard"
        end if
        m.detailVideoStatus.text = "Navigation"
        m.detailAuthStatus.text = getAuthStatusLabel()
    else if navId = "home" then
        m.detailTitle.text = "Home"
        m.detailMeta.text = "Browse Flyhigh"
        m.detailSynopsis.text = "Featured films and curated category rows are ready to browse. Press Right to return to the titles."
        m.detailVideoStatus.text = "Navigation"
        m.detailAuthStatus.text = getAuthStatusLabel()
        m.detailAction.text = "OK or Right: browse titles"
    else if navId = "my-list" then
        m.detailTitle.text = "My List"
        m.detailMeta.text = "Saved titles"
        if m.deviceAccessToken = "" then
            m.detailSynopsis.text = "Sign in on this Roku to save and reopen your favorite titles."
            m.detailAction.text = "OK: sign in"
        else if m.myListItems = invalid or m.myListItems.Count() = 0 then
            m.detailSynopsis.text = "Your My List is empty. Press Play/Pause on a title to add it."
            m.detailAction.text = "Right: browse titles"
        else
            m.detailSynopsis.text = "Your saved titles are pinned near the top of the browse rows."
            m.detailAction.text = "Right: browse My List row"
        end if
        m.detailVideoStatus.text = "Navigation"
        m.detailAuthStatus.text = getAuthStatusLabel()
    else
        m.detailTitle.text = "Account"
        m.detailMeta.text = "TV account"
        if m.deviceAccessToken <> "" then
            m.detailSynopsis.text = "This Roku is linked to your Flyhigh account. Sign out here if you want to switch accounts on this TV."
            m.detailAuthStatus.text = "TV signed in"
            m.detailAction.text = "OK: sign out on this TV"
        else
            m.detailSynopsis.text = "Sign in with a code on your phone or computer to unlock premium playback, My List, and Continue Watching."
            m.detailAuthStatus.text = "TV not signed in"
            m.detailAction.text = "OK: get sign-in code"
        end if
        m.detailVideoStatus.text = "Navigation"
    end if
end sub

function getAuthStatusLabel() as String
    if m.deviceAccessToken <> "" then return "TV signed in"
    return "TV not signed in"
end function

function handleNavigationKey(normalizedKey as String) as Boolean
    if normalizedKey = "up" then
        m.navIndex = m.navIndex - 1
        if m.navIndex < 0 then m.navIndex = m.navRows.Count() - 1
        renderNavigation()
        showNavigationDetail()
        return true
    else if normalizedKey = "down" then
        m.navIndex = (m.navIndex + 1) mod m.navRows.Count()
        renderNavigation()
        showNavigationDetail()
        return true
    else if normalizedKey = "right" or normalizedKey = "back" or normalizedKey = "backspace" then
        exitNavigation()
        return true
    else if normalizedKey = "ok" then
        activateNavigationItem()
        return true
    end if

    return true
end function

sub activateNavigationItem()
    navId = m.navRows[m.navIndex]
    if navId = "search" then
        openSearchDialog()
    else if navId = "home" then
        showHomeBrowse()
        exitNavigation()
    else if navId = "my-list" then
        if m.deviceAccessToken = "" then
            beginDeviceLogin()
        else
            m.statusLabel.text = "My List is pinned near the top when titles are saved"
            exitNavigation()
        end if
    else if navId = "account" then
        if m.deviceAccessToken <> "" then
            signOutDevice()
        else
            beginDeviceLogin()
        end if
    end if
end sub

sub signOutDevice()
    stopHeroPreview()
    m.deviceAccessToken = ""
    clearDeviceToken()
    m.continueWatchingItems = []
    clearMyListRow()
    refreshAuthCopy()
    renderNavigation()
    m.statusLabel.text = "Signed out on this TV"
    m.detailTitle.text = "Account"
    m.detailMeta.text = "TV account"
    m.detailSynopsis.text = "This Roku has been signed out. Use OK to request a new sign-in code."
    m.detailVideoStatus.text = "Navigation"
    m.detailAuthStatus.text = "TV not signed in"
    m.detailAction.text = "OK: get sign-in code"
end sub

sub attemptPlayback(item as Object)
    if item = invalid then
        if m.deviceAccessToken = "" then
            m.statusLabel.text = "Opening TV sign-in..."
            beginDeviceLogin()
        else
            m.statusLabel.text = "Choose a title first"
        end if
        return
    end if

    contentId = safeToString(item.id)
    if safeToString(item.specialAction) = "sign-in" then
        m.statusLabel.text = "Opening TV sign-in..."
        beginDeviceLogin()
        return
    else if safeToString(item.specialAction) = "account" then
        m.statusLabel.text = "Refreshing TV sign-in..."
        beginDeviceLogin()
        return
    end if

    if contentId = "" then
        m.statusLabel.text = "Selected title is missing content ID"
        return
    end if

    if m.deviceAccessToken = "" and item.isPremium = true then
        m.statusLabel.text = "Sign in required for this title"
        beginDeviceLogin()
        return
    end if

    m.playbackFailed = false
    m.statusLabel.text = "Checking playback..."
    runTask(m.playbackTask, "/v1/content/" + contentId + "/playback", "POST", invalid, m.deviceAccessToken, "playback")
end sub

sub onPlaybackTaskResponse()
    res = m.playbackTask.response
    if res = invalid then return

    if m.playbackTask.statusCode >= 200 and m.playbackTask.statusCode < 300 then
        if res.allowed = true and res.playbackUrl <> invalid then
            openVideoPlayer(safeToString(res.playbackUrl), safeToString(m.currentItem.title))
            m.statusLabel.text = "Playing " + safeToString(m.currentItem.title)
            m.playbackFailed = false
            return
        end if
    end if

    reason = ""
    if res.reason <> invalid then reason = LCase(safeToString(res.reason))
    if reason = "requires_subscription" then
        m.statusLabel.text = "Sign in required for this title"
        beginDeviceLogin()
        m.authStatusLabel.text = "Approve this device to watch premium content"
    else
        m.statusLabel.text = "Playback unavailable"
        m.playbackFailed = true
    end if
end sub
sub onPlaybackTaskError()
    if m.playbackTask.errorMessage = invalid or m.playbackTask.errorMessage = "" then return
    if m.playbackTask.response <> invalid then
        responseReason = ""
        if m.playbackTask.response.reason <> invalid then responseReason = LCase(safeToString(m.playbackTask.response.reason))
        responseError = ""
        if m.playbackTask.response.error <> invalid then responseError = LCase(safeToString(m.playbackTask.response.error))
        if responseReason = "requires_subscription" or responseError = "forbidden" then
            if m.deviceAccessToken <> "" then
                m.statusLabel.text = "Subscription required"
                m.detailAuthStatus.text = "Signed in, but this account is not currently entitled for this premium title."
                m.detailAction.text = "Use a subscribed account, an admin account, or manage subscription on the web."
            else
                m.statusLabel.text = "Sign in required"
                beginDeviceLogin()
            end if
            return
        end if
    end if
    m.statusLabel.text = "Playback error: " + m.playbackTask.errorMessage
    m.playbackFailed = true
end sub

sub openVideoPlayer(playbackUrl as String, title as String)
    stopHeroPreview()
    content = CreateObject("roSGNode", "ContentNode")
    content.title = title
    content.url = playbackUrl
    content.streamFormat = "hls"

    m.videoPlayer.visible = true
    m.videoPlayer.content = content
    m.videoPlayer.control = "play"
    m.videoPlayer.setFocus(true)
end sub

sub closeVideoPlayer()
    if m.videoPlayer = invalid then return
    m.videoPlayer.control = "stop"
    m.videoPlayer.visible = false
    m.rowList.setFocus(true)
    renderHeroForItem(m.currentItem)
end sub

sub onVideoStateChanged()
    state = LCase(safeToString(m.videoPlayer.state))
    if state = "finished" or state = "error" or state = "stopped" then
        if m.videoPlayer.visible = true then closeVideoPlayer()
    end if
end sub

function onKeyEvent(key as String, press as Boolean) as Boolean
    if press = false then return false

    if m.authPanel.visible = true then
        m.authCloseHint.text = "Last key: " + key + "   Back or Left: close"
    end if

    normalizedKey = LCase(key)

    if m.primaryFocusZone = "nav" then
        return handleNavigationKey(normalizedKey)
    end if

    if normalizedKey = "back" or normalizedKey = "backspace" then
        if m.videoPlayer.visible = true then
            closeVideoPlayer()
            return true
        end if
        if m.authPanel.visible = true then
            closeAuthPanel()
            return true
        end if
        if m.authFlowActive = true then
            closeAuthPanel()
            if m.rowList.rowItemFocused = invalid then
                showDetailFromIndexes([0, 0])
            else
                showDetailFromIndexes(m.rowList.rowItemFocused)
            end if
            return true
        end if
        enterNavigation()
        return true
    end if

    if m.authPanel.visible = true then
        if normalizedKey = "left" or normalizedKey = "back" or normalizedKey = "backspace" then
            closeAuthPanel()
            return true
        end if

        if normalizedKey = "down" or normalizedKey = "up" or normalizedKey = "left" or normalizedKey = "right" then
            return true
        end if

        if normalizedKey = "ok" or normalizedKey = "options" or normalizedKey = "play" then
            return true
        end if

        return true
    end if

    if normalizedKey = "options" then
        m.navIndex = 3
        enterNavigation()
        beginDeviceLogin()
        return true
    end if

    if normalizedKey = "left" then
        if m.videoPlayer.visible = true then return false
        enterNavigation()
        return true
    end if

    if normalizedKey = "play" then
        if m.videoPlayer.visible = true then return false
        if m.authPanel.visible = true then return true
        toggleMyList(m.currentItem)
        return true
    end if

    if normalizedKey = "replay" then
        if m.videoPlayer.visible = true then return false
        if m.playbackFailed and m.currentItem <> invalid then
            m.statusLabel.text = "Retrying playback..."
            attemptPlayback(m.currentItem)
            return true
        end if

        if m.homeLoadFailed then
            m.statusLabel.text = "Retrying home feed..."
            loadHomeFeed()
            return true
        end if
    end if

    if normalizedKey = "ok" then
        if m.videoPlayer.visible = true then return true
        if m.authPanel.visible = true then return true
        attemptPlayback(m.currentItem)
        return true
    end if

    return false
end function

function safeToString(value as Dynamic) as String
    if value = invalid then return ""
    return value.ToStr()
end function

sub setPrimaryFocusZone(zone as String)
    m.primaryFocusZone = zone

    m.signInButtonBg.color = "0x16313FFF"
    m.signInButtonLabel.color = "0xF5F7FAFF"
    m.rowList.setFocus(true)
    renderNavigation()
end sub

sub refreshAuthCopy()
    if m.deviceAccessToken <> "" then
        m.authShortcutLabel.text = "Signed in"
        m.signInButtonGroup.visible = false
        m.hintLabel.text = "OK: Play / Details    Play/Pause: My List    Replay: Retry    *: Switch TV sign-in"
        setPrimaryFocusZone("rows")
    else
        m.authShortcutLabel.text = "Signed out"
        m.signInButtonGroup.visible = false
        m.hintLabel.text = "OK: Play    Left: Menu    Play/Pause: My List    *: Sign in"
        setPrimaryFocusZone("rows")
    end if
    renderNavigation()
end sub

function getPosterUrl(item as Object) as String
    if safeToString(item.specialAction) = "sign-in" then
        return "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80"
    else if safeToString(item.specialAction) = "account" then
        return "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=80"
    end if
    posterUrl = safeToString(item.posterUrl)
    if posterUrl <> "" then return optimizePosterUrl(posterUrl)
    return "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=440&q=70&fit=crop"
end function

function optimizePosterUrl(url as String) as String
    if url = "" then return ""

    if Instr(1, url, "image.mux.com/") > 0 then
        separator = "?"
        if Instr(1, url, "?") > 0 then separator = "&"
        return url + separator + "width=440&height=232&fit_mode=preserve"
    end if

    return url
end function

function getPreviewUrl(item as Object) as String
    if item = invalid then return ""
    previewUrl = safeToString(item.previewUrl)
    if previewUrl <> "" then return previewUrl
    heroPreviewUrl = safeToString(item.heroPreviewUrl)
    if heroPreviewUrl <> "" then return heroPreviewUrl
    return ""
end function

function getReleaseYearLabel(item as Object) as String
    if item <> invalid and item.releaseYear <> invalid then
        return safeToString(item.releaseYear)
    end if
    return "n/a"
end function

function getDurationMinutesLabel(item as Object) as String
    if item <> invalid and item.durationSeconds <> invalid then
        durationSeconds = val(safeToString(item.durationSeconds))
        if durationSeconds > 0 then
            return Int(durationSeconds / 60).ToStr()
        end if
    end if
    return "0"
end function

function urlEncode(value as String) as String
    encoded = ""
    for i = 1 to Len(value)
        ch = Mid(value, i, 1)
        code = Asc(ch)
        if (code >= 48 and code <= 57) or (code >= 65 and code <= 90) or (code >= 97 and code <= 122) then
            encoded = encoded + ch
        else if ch = " " then
            encoded = encoded + "%20"
        else if ch = "-" or ch = "_" or ch = "." or ch = "~" then
            encoded = encoded + ch
        else
            hex = Right("0" + Hex(code), 2)
            encoded = encoded + "%" + hex
        end if
    end for
    return encoded
end function

sub signalLaunchCompleteIfNeeded()
    if m.launchCompleteSent = true then return
    m.top.signalBeacon("AppLaunchComplete")
    m.launchCompleteSent = true
end sub

sub signalDialogInitiate()
    if m.dialogBeaconOpenCount = 0 then
        m.top.signalBeacon("AppDialogInitiate")
    end if
    m.dialogBeaconOpenCount = m.dialogBeaconOpenCount + 1
end sub

sub signalDialogComplete()
    if m.dialogBeaconOpenCount <= 0 then return
    m.dialogBeaconOpenCount = m.dialogBeaconOpenCount - 1
    if m.dialogBeaconOpenCount = 0 then
        m.top.signalBeacon("AppDialogComplete")
    end if
end sub

function loadDeviceToken() as String
    sec = CreateObject("roRegistrySection", "flyhigh")
    token = sec.Read("deviceAccessToken")
    if token = invalid then return ""
    return token
end function

sub saveDeviceToken(token as String)
    sec = CreateObject("roRegistrySection", "flyhigh")
    sec.Write("deviceAccessToken", token)
    sec.Flush()
end sub

sub clearDeviceToken()
    sec = CreateObject("roRegistrySection", "flyhigh")
    sec.Delete("deviceAccessToken")
    sec.Flush()
end sub
