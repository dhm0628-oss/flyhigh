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
    xfer.SetUrl(url)
    xfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
    xfer.InitClientCertificates()
    xfer.SetRequest("User-Agent", "FlyhighRoku/0.1")
    xfer.SetRequest("Accept", "application/json")

    authToken = m.top.authToken
    if authToken <> invalid and authToken <> ""
        xfer.SetRequest("Authorization", "Bearer " + authToken)
    end if

    method = UCase(m.top.method)
    body = m.top.body

    responseText = ""
    if method = "POST" or method = "PATCH"
        xfer.SetRequest("Content-Type", "application/json")
        payload = "{}"
        if body <> invalid then payload = FormatJson(body)

        if method = "POST"
            responseText = xfer.PostFromString(payload)
        else
            xfer.SetRequestMethod("PATCH")
            responseText = xfer.PostFromString(payload)
        end if
    else if method = "DELETE"
        xfer.SetRequestMethod("DELETE")
        responseText = xfer.PostFromString("")
    else
        responseText = xfer.GetToString()
    end if

    m.top.statusCode = xfer.GetResponseCode()

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
