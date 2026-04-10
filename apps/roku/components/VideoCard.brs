sub init()
    m.poster = m.top.findNode("poster")
    m.posterFallback = m.top.findNode("posterFallback")
    m.titleLabel = m.top.findNode("titleLabel")
    m.focusBorder = m.top.findNode("focusBorder")
    m.poster.observeField("loadStatus", "onPosterLoadStatusChanged")
end sub

sub onItemContentChanged()
    item = m.top.itemContent
    if item = invalid then return

    title = ""
    if item.title <> invalid then title = item.title.ToStr()
    m.titleLabel.text = title

    posterUrl = ""
    if item.hdPosterUrl <> invalid then posterUrl = item.hdPosterUrl.ToStr()
    if posterUrl = "" and item.HDPosterUrl <> invalid then posterUrl = item.HDPosterUrl.ToStr()
    if posterUrl = "" and item.posterUrl <> invalid then posterUrl = item.posterUrl.ToStr()

    m.poster.visible = false
    m.poster.uri = ""
    m.posterFallback.visible = true

    if posterUrl <> "" then
        m.poster.uri = posterUrl
    end if
end sub

sub onFocusChanged()
    m.focusBorder.visible = m.top.focusPercent > 0.25
end sub

sub onPosterLoadStatusChanged()
    status = LCase(m.poster.loadStatus)
    if status = "ready" or status = "loaded" then
        m.poster.visible = true
        m.posterFallback.visible = false
    else if status = "failed" or status = "error" then
        m.poster.visible = false
        m.posterFallback.visible = true
    end if
end sub
