sub init()
    m.config = Flyhigh_GetConfig()

    m.headerLabel = m.top.findNode("headerLabel")
    m.statusLabel = m.top.findNode("statusLabel")
    m.hintLabel = m.top.findNode("hintLabel")
    m.heroPanel = m.top.findNode("heroPanel")
    m.heroPoster = m.top.findNode("heroPoster")
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
    m.pollTimer = m.top.findNode("pollTimer")
    m.heroTimer = m.top.findNode("heroTimer")
    m.videoPlayer = m.top.findNode("videoPlayer")

    m.homeTask = m.top.findNode("homeTask")
    m.myListTask = m.top.findNode("myListTask")
    m.myListToggleTask = m.top.findNode("myListToggleTask")
    m.deviceStartTask = m.top.findNode("deviceStartTask")
    m.devicePollTask = m.top.findNode("devicePollTask")
    m.playbackTask = m.top.findNode("playbackTask")

    m.feedRows = []
    m.myListIds = CreateObject("roAssociativeArray")
    m.currentItem = invalid
    m.homeLoadFailed = false
    m.playbackFailed = false
    m.deviceLoginId = ""
    m.deviceCode = ""
    m.devicePollInFlight = false
    m.deviceAccessToken = loadDeviceToken()
    m.heroItems = []
    m.heroIndex = 0

    setupTask(m.homeTask, "onHomeTaskResponse", "onHomeTaskError")
    setupTask(m.myListTask, "onMyListTaskResponse", "onMyListTaskError")
    setupTask(m.myListToggleTask, "onMyListToggleTaskResponse", "onMyListToggleTaskError")
    setupTask(m.deviceStartTask, "onDeviceStartTaskResponse", "onDeviceStartTaskError")
    setupTask(m.devicePollTask, "onDevicePollTaskResponse", "onDevicePollTaskError")
    setupTask(m.playbackTask, "onPlaybackTaskResponse", "onPlaybackTaskError")

    m.rowList.observeField("rowItemFocused", "onRowItemFocused")
    m.rowList.observeField("rowItemSelected", "onRowItemSelected")
    m.pollTimer.observeField("fire", "onPollTimerFire")
    m.heroTimer.observeField("fire", "onHeroTimerFire")
    m.videoPlayer.observeField("state", "onVideoStateChanged")

    m.top.setFocus(true)
    m.rowList.setFocus(true)

    if m.deviceAccessToken <> "" then
        m.detailAuthStatus.text = "TV session token loaded"
    else
        m.detailAuthStatus.text = "Not signed in on TV (press *)"
    end if

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

sub runTask(task as Object, path as String, method = "GET" as String, body = invalid as Dynamic, authToken = "" as String, requestTag = "" as String)
    task.control = "STOP"
    task.apiBaseUrl = m.config.apiBaseUrl
    task.path = path
    task.method = method
    task.body = body
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

    setHeroItems(featuredItems)

    m.feedRows = rows
    m.homeLoadFailed = false

    renderRows()
    m.statusLabel.text = "Loaded " + rows.Count().ToStr() + " rows"

    if m.deviceAccessToken <> "" then
        loadMyList()
    else
        clearMyListRow()
    end if

    focused = m.rowList.rowItemFocused
    if focused = invalid then
        showDetailFromIndexes([0, 0])
    else
        showDetailFromIndexes(focused)
    end if
end sub

sub renderRows()
    root = CreateObject("roSGNode", "ContentNode")
    for each row in m.feedRows
        rowNode = CreateObject("roSGNode", "ContentNode")
        rowNode.Title = row.title

        items = []
        if row.items <> invalid then items = row.items
        for each item in items
            itemNode = CreateObject("roSGNode", "ContentNode")
            itemNode.AddField("contentId", "string", false)
            itemNode.AddField("slug", "string", false)
            itemNode.AddField("synopsis", "string", false)
            itemNode.AddField("isPremium", "boolean", false)
            itemNode.AddField("videoStatus", "string", false)
            itemNode.Title = item.title
            itemNode.ShortDescriptionLine1 = item.title
            yearLabel = "n/a"
            if item.releaseYear <> invalid then yearLabel = safeToString(item.releaseYear)
            itemNode.ShortDescriptionLine2 = safeToString(item.type) + " | " + yearLabel
            itemNode.HDPosterUrl = item.posterUrl
            itemNode.contentId = item.id
            itemNode.slug = item.slug
            itemNode.synopsis = item.synopsis
            itemNode.isPremium = item.isPremium
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

    m.heroPoster.uri = safeToString(item.posterUrl)
    m.heroTitle.text = safeToString(item.title)
    yearLabel = "n/a"
    if item.releaseYear <> invalid then yearLabel = safeToString(item.releaseYear)
    durationMin = "0"
    if item.durationSeconds <> invalid then durationMin = Int(item.durationSeconds / 60).ToStr()
    m.heroMeta.text = safeToString(item.type) + " | " + yearLabel + " | " + durationMin + " min"
    m.heroSynopsis.text = safeToString(item.synopsis)
    m.heroDots.text = (m.heroIndex + 1).ToStr() + "/" + m.heroItems.Count().ToStr() + "  -  OK to play selected title"
end sub

sub onHeroTimerFire()
    if m.heroItems = invalid or m.heroItems.Count() <= 1 then return
    m.heroIndex = (m.heroIndex + 1) mod m.heroItems.Count()
    renderHero()
end sub

sub onHomeTaskError()
    if m.homeTask.errorMessage = invalid or m.homeTask.errorMessage = "" then return
    m.homeLoadFailed = true
    m.statusLabel.text = "Home feed error: " + m.homeTask.errorMessage
    m.hintLabel.text = "Replay: Retry home feed    OK: Play    Play/Pause: My List    *: TV Sign-in"
end sub

sub onRowItemFocused()
    idx = m.rowList.rowItemFocused
    if idx = invalid then return
    showDetailFromIndexes(idx)
end sub

sub onRowItemSelected()
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
    releaseYear = "n/a"
    if item.releaseYear <> invalid then releaseYear = safeToString(item.releaseYear)
    durationMin = "0"
    if item.durationSeconds <> invalid then durationMin = Int(item.durationSeconds / 60).ToStr()

    m.detailTitle.text = title
    m.detailMeta.text = safeToString(item.type) + " | " + releaseYear + " | " + durationMin + " min"
    m.detailSynopsis.text = safeToString(item.synopsis)
    premiumLabel = "Free"
    if item.isPremium = true then premiumLabel = "Subscriber only"
    m.detailVideoStatus.text = "Visibility: " + premiumLabel
    if m.deviceAccessToken <> "" then
        m.detailAuthStatus.text = "TV signed in"
    else
        m.detailAuthStatus.text = "TV not signed in (press * to activate)"
    end if

    if isInMyList(safeToString(item.id)) then
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

sub clearMyListRow()
    m.myListIds = CreateObject("roAssociativeArray")
    nextRows = []
    for each row in m.feedRows
        if row <> invalid and row.id <> invalid and LCase(safeToString(row.id)) = "my-list" then
            ' skip
        else
            nextRows.Push(row)
        end if
    end for
    m.feedRows = nextRows
    renderRows()
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

    nextRows = []
    for each row in m.feedRows
        if row <> invalid and row.id <> invalid and LCase(safeToString(row.id)) = "my-list" then
            ' skip existing row; we will reinsert at top if needed
        else
            nextRows.Push(row)
        end if
    end for

    if items.Count() > 0 then
        myListRow = {
            id: "my-list"
            title: title
            items: items
        }
        mergedRows = [myListRow]
        for each row in nextRows
            mergedRows.Push(row)
        end for
        m.feedRows = mergedRows
    else
        m.feedRows = nextRows
    end if
    renderRows()
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
        body = { contentId: contentId }
        runTask(m.myListToggleTask, "/v1/viewer/my-list", "POST", body, m.deviceAccessToken, "my-list-add")
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
    m.authPanel.visible = true
    m.authCodeLabel.text = "------"
    m.authUrlLabel.text = m.config.webActivateBaseUrl + "/activate"
    m.authStatusLabel.text = "Requesting device code..."
    m.deviceLoginId = ""
    m.deviceCode = ""
    m.devicePollInFlight = false

    body = { clientName: m.config.appName }
    runTask(m.deviceStartTask, "/v1/device-auth/start", "POST", body, "", "device-start")
end sub

sub onDeviceStartTaskResponse()
    res = m.deviceStartTask.response
    if res = invalid then return

    m.deviceLoginId = safeToString(res.deviceLoginId)
    m.deviceCode = safeToString(res.userCode)

    if m.deviceCode = "" or m.deviceLoginId = "" then
        m.authStatusLabel.text = "Could not start device login"
        return
    end if

    m.authCodeLabel.text = m.deviceCode
    m.authUrlLabel.text = m.config.webActivateBaseUrl + "/activate?code=" + m.deviceCode
    m.authStatusLabel.text = "On a phone/computer, open the URL and approve this code"
    m.pollTimer.control = "start"
end sub

sub onDeviceStartTaskError()
    if m.deviceStartTask.errorMessage = invalid or m.deviceStartTask.errorMessage = "" then return
    m.authPanel.visible = true
    m.authStatusLabel.text = "Device login error: " + m.deviceStartTask.errorMessage
end sub

sub onPollTimerFire()
    if m.deviceLoginId = "" then return
    if m.devicePollInFlight then return
    if m.authPanel.visible <> true then return

    m.devicePollInFlight = true
    body = { deviceLoginId: m.deviceLoginId }
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
        return
    else if status = "approved" then
        token = safeToString(res.accessToken)
        if token <> "" then
            m.deviceAccessToken = token
            saveDeviceToken(token)
            m.detailAuthStatus.text = "TV signed in"
            viewerName = ""
            if res.viewer <> invalid and res.viewer.displayName <> invalid then viewerName = safeToString(res.viewer.displayName)
                            m.authStatusLabel.text = "Approved for " + viewerName
                            m.pollTimer.control = "stop"
                            m.authPanel.visible = false
                            m.statusLabel.text = "TV sign-in complete"
                            loadMyList()
                        end if
    else if status = "expired" then
        m.authStatusLabel.text = "Code expired. Press * to request a new code."
        m.pollTimer.control = "stop"
    else if status = "denied" then
        m.authStatusLabel.text = "Code denied. Press * to try again."
        m.pollTimer.control = "stop"
    else if status = "consumed" then
        m.authStatusLabel.text = "Code already used. Press * for a new code."
        m.pollTimer.control = "stop"
    end if
end sub

sub onDevicePollTaskError()
    m.devicePollInFlight = false
    if m.devicePollTask.errorMessage = invalid or m.devicePollTask.errorMessage = "" then return
    m.authStatusLabel.text = "Polling error: " + m.devicePollTask.errorMessage
end sub

sub attemptPlayback(item as Object)
    if item = invalid then return

    path = "/v1/content/" + safeToString(item.id) + "/playback"
    token = m.deviceAccessToken
    if token = invalid then token = ""

    m.statusLabel.text = "Requesting playback for " + safeToString(item.title)
    runTask(m.playbackTask, path, "POST", {}, token, "playback")
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
    if m.playbackTask.response <> invalid and m.playbackTask.response.reason <> invalid
        if LCase(safeToString(m.playbackTask.response.reason)) = "requires_subscription" then
            m.statusLabel.text = "Subscription required"
            beginDeviceLogin()
            return
        end if
    end if
    m.statusLabel.text = "Playback error: " + m.playbackTask.errorMessage
    m.playbackFailed = true
end sub

sub openVideoPlayer(playbackUrl as String, title as String)
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
end sub

sub onVideoStateChanged()
    state = LCase(safeToString(m.videoPlayer.state))
    if state = "finished" or state = "error" or state = "stopped" then
        if m.videoPlayer.visible = true then closeVideoPlayer()
    end if
end sub

function onKeyEvent(key as String, press as Boolean) as Boolean
    if press = false then return false

    if key = "back" then
        if m.videoPlayer.visible = true then
            closeVideoPlayer()
            return true
        end if
        if m.authPanel.visible = true then
            m.authPanel.visible = false
            m.pollTimer.control = "stop"
            m.rowList.setFocus(true)
            return true
        end if
        return false
    end if

    if key = "options" then
        beginDeviceLogin()
        return true
    end if

    if key = "play" then
        if m.videoPlayer.visible = true then return false
        if m.authPanel.visible = true then return true
        toggleMyList(m.currentItem)
        return true
    end if

    if key = "replay" then
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

    if key = "OK" then
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
