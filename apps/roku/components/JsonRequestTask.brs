sub init()
    m.top.functionName = "run"
end sub

sub run()
    m.top.errorMessage = ""
    m.top.response = invalid
    m.top.statusCode = 0

    baseUrl = m.top.apiBaseUrl
    path = m.top.path
    if baseUrl = invalid or path = invalid or baseUrl = "" or path = ""
        m.top.errorMessage = "Missing apiBaseUrl or path"
        return
    end if

    url = baseUrl + path
    xfer = CreateObject("roUrlTransfer")
    port = CreateObject("roMessagePort")
    xfer.SetMessagePort(port)
    xfer.SetUrl(url)
    xfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
    xfer.InitClientCertificates()
    xfer.AddHeader("User-Agent", "FlyhighRoku/0.1")
    xfer.AddHeader("Accept", "application/json")

    authToken = m.top.authToken
    if authToken <> invalid and authToken <> ""
        xfer.AddHeader("Authorization", "Bearer " + authToken)
    end if

    method = UCase(m.top.method)
    bodyJson = m.top.bodyJson

    started = false
    if method = "POST" or method = "PATCH"
        xfer.AddHeader("Content-Type", "application/json")
        payload = "{}"
        if bodyJson <> invalid and bodyJson <> "" then payload = bodyJson

        if method = "PATCH"
            xfer.SetRequestMethod("PATCH")
        end if
        started = xfer.AsyncPostFromString(payload)
    else if method = "DELETE"
        xfer.SetRequestMethod("DELETE")
        started = xfer.AsyncPostFromString("")
    else
        started = xfer.AsyncGetToString()
    end if

    if started <> true then
        m.top.errorMessage = "Network request could not start"
        m.top.statusCode = 0
        return
    end if

    msg = wait(15000, port)
    if msg = invalid then
        xfer.AsyncCancel()
        m.top.errorMessage = "Network request timed out"
        m.top.statusCode = 0
        return
    end if

    responseText = invalid
    if type(msg) = "roUrlEvent" then
        m.top.statusCode = msg.GetResponseCode()
        responseText = msg.GetString()
        if responseText = invalid or responseText = "" then
            failureReason = msg.GetFailureReason()
            if failureReason <> invalid and failureReason <> "" then
                m.top.errorMessage = failureReason
                return
            end if
        end if
    else
        m.top.errorMessage = "Unexpected network response"
        m.top.statusCode = 0
        return
    end if

    if responseText = invalid then
        m.top.errorMessage = "Network request failed"
        return
    end if

    parsed = ParseJson(responseText)
    if parsed = invalid then
        if m.top.statusCode >= 200 and m.top.statusCode < 300
            m.top.response = {}
        else
            m.top.errorMessage = "HTTP " + m.top.statusCode.ToStr()
        end if
        return
    end if

    if parsed.statusCode <> invalid then
        m.top.statusCode = parsed.statusCode
    end if

    if m.top.statusCode < 200 or m.top.statusCode >= 300
        m.top.response = parsed
        if parsed.error <> invalid then
            m.top.errorMessage = parsed.error
        else
            m.top.errorMessage = "HTTP " + m.top.statusCode.ToStr()
        end if
        return
    end if

    m.top.response = parsed
end sub
