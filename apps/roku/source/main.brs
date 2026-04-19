sub Main(args = invalid as Dynamic)
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
    input = CreateObject("roInput")
    input.SetMessagePort(port)

    scene = screen.CreateScene("MainScene")
    screen.Show()
    if args <> invalid then
        handleInputLaunch(scene, args)
    end if

    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then return
        else if type(msg) = "roInputEvent"
            handleInputEvent(scene, msg)
        end if
    end while
end sub

sub handleInputLaunch(scene as Object, args as Dynamic)
    if scene = invalid or args = invalid then return

    if args.contentId <> invalid then
        scene.launchContentId = args.contentId
    else if args.contentID <> invalid then
        scene.launchContentId = args.contentID
    end if

    if args.mediaType <> invalid then
        scene.launchMediaType = args.mediaType
    end if
end sub

sub handleInputEvent(scene as Object, msg as Object)
    if scene = invalid or msg = invalid then return

    info = invalid
    if msg.getInfo <> invalid then info = msg.getInfo()
    if info = invalid then return

    contentId = invalid
    if info.contentId <> invalid then
        contentId = info.contentId
    else if info.contentID <> invalid then
        contentId = info.contentID
    end if

    if contentId <> invalid then
        scene.launchContentId = contentId
    end if

    if info.mediaType <> invalid then
        scene.launchMediaType = info.mediaType
    end if
end sub
