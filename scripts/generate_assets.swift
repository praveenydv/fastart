import Foundation
import CoreGraphics
import AppKit

func hexColor(_ hex: String, alpha: CGFloat = 1.0) -> CGColor {
    var str = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    if str.hasPrefix("#") { str.removeFirst() }
    var rgbValue: UInt64 = 0
    Scanner(string: str).scanHexInt64(&rgbValue)
    let r = CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0
    let g = CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0
    let b = CGFloat(rgbValue & 0x0000FF) / 255.0
    return CGColor(red: r, green: g, blue: b, alpha: alpha)
}

func createFastArtIcon(size: CGFloat, transparentBg: Bool = false) -> CGImage? {
    let width = Int(size)
    let height = Int(size)
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue

    guard let ctx = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width * 4,
        space: colorSpace,
        bitmapInfo: bitmapInfo
    ) else { return nil }

    ctx.setAllowsAntialiasing(true)
    ctx.setShouldAntialias(true)
    ctx.interpolationQuality = .high

    let scale = size / 1024.0

    // 1. Background
    if !transparentBg {
        // Deep obsidian squircle background
        let cornerRadius = 230.0 * scale
        let bgRect = CGRect(x: 0, y: 0, width: size, height: size)
        let bgPath = CGPath(roundedRect: bgRect, cornerWidth: cornerRadius, cornerHeight: cornerRadius, transform: nil)

        ctx.saveGState()
        ctx.addPath(bgPath)
        ctx.clip()

        // Background gradient: deep dark cosmic obsidian
        let bgColors = [
            hexColor("#13192B"),
            hexColor("#0B0E17"),
            hexColor("#07080D")
        ] as CFArray
        let bgLocations: [CGFloat] = [0.0, 0.5, 1.0]
        if let bgGrad = CGGradient(colorsSpace: colorSpace, colors: bgColors, locations: bgLocations) {
            ctx.drawRadialGradient(
                bgGrad,
                startCenter: CGPoint(x: size * 0.45, y: size * 0.55),
                startRadius: 0,
                endCenter: CGPoint(x: size * 0.5, y: size * 0.5),
                endRadius: size * 0.85,
                options: [.drawsAfterEndLocation, .drawsBeforeStartLocation]
            )
        }

        // Ambient glow behind the logo core (Cyan top, Violet bottom)
        let cyanGlowColors = [hexColor("#00F2FE", alpha: 0.18), hexColor("#00F2FE", alpha: 0.0)] as CFArray
        if let cyanGlow = CGGradient(colorsSpace: colorSpace, colors: cyanGlowColors, locations: [0.0, 1.0]) {
            ctx.drawRadialGradient(
                cyanGlow,
                startCenter: CGPoint(x: size * 0.45, y: size * 0.60),
                startRadius: 0,
                endCenter: CGPoint(x: size * 0.45, y: size * 0.60),
                endRadius: size * 0.45,
                options: []
            )
        }

        let violetGlowColors = [hexColor("#8B5CF6", alpha: 0.16), hexColor("#8B5CF6", alpha: 0.0)] as CFArray
        if let violetGlow = CGGradient(colorsSpace: colorSpace, colors: violetGlowColors, locations: [0.0, 1.0]) {
            ctx.drawRadialGradient(
                violetGlow,
                startCenter: CGPoint(x: size * 0.55, y: size * 0.40),
                startRadius: 0,
                endCenter: CGPoint(x: size * 0.55, y: size * 0.40),
                endRadius: size * 0.45,
                options: []
            )
        }

        // Subtle 1px inner border/stroke
        ctx.addPath(bgPath)
        ctx.setStrokeColor(hexColor("#FFFFFF", alpha: 0.08))
        ctx.setLineWidth(2.0 * scale)
        ctx.strokePath()

        ctx.restoreGState()
    }

    // 2. Draw FastArt Geometric Emblem (F + A + Play Arrow fused ribbon)
    // Coords relative to 1024x1024
    ctx.saveGState()
    ctx.scaleBy(x: scale, y: scale)

    // Shadow for the entire emblem
    ctx.setShadow(offset: CGSize(width: 0, height: -12), blur: 32, color: hexColor("#000000", alpha: 0.6))

    // ── Ribbon 1: Upper Fast "F" / Speed Chevron (Cyan to Electric Azure) ──
    // Starts at top-left, arches down-right to the play tip
    let pathCyan = CGMutablePath()
    pathCyan.move(to: CGPoint(x: 270, y: 720))
    pathCyan.addCurve(to: CGPoint(x: 390, y: 770), control1: CGPoint(x: 270, y: 755), control2: CGPoint(x: 320, y: 770))
    pathCyan.addLine(to: CGPoint(x: 620, y: 770))
    pathCyan.addCurve(to: CGPoint(x: 740, y: 690), control1: CGPoint(x: 680, y: 770), control2: CGPoint(x: 725, y: 740))
    pathCyan.addLine(to: CGPoint(x: 780, y: 535))
    pathCyan.addCurve(to: CGPoint(x: 775, y: 495), control1: CGPoint(x: 788, y: 518), control2: CGPoint(x: 785, y: 504))
    pathCyan.addLine(to: CGPoint(x: 540, y: 495))
    pathCyan.addCurve(to: CGPoint(x: 480, y: 545), control1: CGPoint(x: 505, y: 495), control2: CGPoint(x: 480, y: 515))
    pathCyan.addLine(to: CGPoint(x: 480, y: 630))
    pathCyan.addCurve(to: CGPoint(x: 440, y: 655), control1: CGPoint(x: 480, y: 648), control2: CGPoint(x: 460, y: 655))
    pathCyan.addLine(to: CGPoint(x: 310, y: 655))
    pathCyan.addCurve(to: CGPoint(x: 270, y: 695), control1: CGPoint(x: 285, y: 655), control2: CGPoint(x: 270, y: 672))
    pathCyan.closeSubpath()

    // Upper cyan gradient
    let cyanColors = [
        hexColor("#00F2FE"), // Bright cyan
        hexColor("#00C0FF"), // Electric sky
        hexColor("#0072FF")  // Deep azure
    ] as CFArray
    let cyanGrad = CGGradient(colorsSpace: colorSpace, colors: cyanColors, locations: [0.0, 0.55, 1.0])!

    ctx.saveGState()
    ctx.addPath(pathCyan)
    ctx.clip()
    ctx.drawLinearGradient(cyanGrad, start: CGPoint(x: 270, y: 770), end: CGPoint(x: 780, y: 495), options: [])
    ctx.restoreGState()

    // ── Ribbon 2: Lower Art "A" / Play Triangle (Violet to Neon Magenta to Amber) ──
    let pathViolet = CGMutablePath()
    pathViolet.move(to: CGPoint(x: 270, y: 290))
    pathViolet.addCurve(to: CGPoint(x: 310, y: 250), control1: CGPoint(x: 270, y: 265), control2: CGPoint(x: 285, y: 250))
    pathViolet.addLine(to: CGPoint(x: 630, y: 250))
    pathViolet.addCurve(to: CGPoint(x: 735, y: 315), control1: CGPoint(x: 685, y: 250), control2: CGPoint(x: 720, y: 275))
    pathViolet.addLine(to: CGPoint(x: 780, y: 490))
    pathViolet.addCurve(to: CGPoint(x: 775, y: 525), control1: CGPoint(x: 785, y: 505), control2: CGPoint(x: 788, y: 515))
    pathViolet.addLine(to: CGPoint(x: 650, y: 440))
    pathViolet.addCurve(to: CGPoint(x: 580, y: 365), control1: CGPoint(x: 625, y: 420), control2: CGPoint(x: 600, y: 390))
    pathViolet.addLine(to: CGPoint(x: 420, y: 365))
    pathViolet.addCurve(to: CGPoint(x: 375, y: 410), control1: CGPoint(x: 395, y: 365), control2: CGPoint(x: 375, y: 385))
    pathViolet.addLine(to: CGPoint(x: 375, y: 480))
    pathViolet.addLine(to: CGPoint(x: 300, y: 480))
    pathViolet.addCurve(to: CGPoint(x: 270, y: 440), control1: CGPoint(x: 280, y: 480), control2: CGPoint(x: 270, y: 465))
    pathViolet.closeSubpath()

    let violetColors = [
        hexColor("#8B5CF6"), // Electric violet
        hexColor("#EC4899"), // Neon magenta / fuchsia
        hexColor("#FF6B4A")  // Radiant coral-amber
    ] as CFArray
    let violetGrad = CGGradient(colorsSpace: colorSpace, colors: violetColors, locations: [0.0, 0.55, 1.0])!

    ctx.saveGState()
    ctx.addPath(pathViolet)
    ctx.clip()
    ctx.drawLinearGradient(violetGrad, start: CGPoint(x: 270, y: 250), end: CGPoint(x: 780, y: 525), options: [])
    ctx.restoreGState()

    // ── Ribbon 3: Center Bridge / Forward Speed Arrow (Connecting & Interlocking Core) ──
    let pathCenter = CGMutablePath()
    pathCenter.move(to: CGPoint(x: 375, y: 580))
    pathCenter.addLine(to: CGPoint(x: 680, y: 580))
    pathCenter.addCurve(to: CGPoint(x: 730, y: 550), control1: CGPoint(x: 705, y: 580), control2: CGPoint(x: 725, y: 570))
    pathCenter.addLine(to: CGPoint(x: 805, y: 512))
    pathCenter.addLine(to: CGPoint(x: 730, y: 474))
    pathCenter.addCurve(to: CGPoint(x: 680, y: 444), control1: CGPoint(x: 725, y: 454), control2: CGPoint(x: 705, y: 444))
    pathCenter.addLine(to: CGPoint(x: 430, y: 444))
    pathCenter.addCurve(to: CGPoint(x: 375, y: 494), control1: CGPoint(x: 400, y: 444), control2: CGPoint(x: 375, y: 464))
    pathCenter.closeSubpath()

    let centerColors = [
        hexColor("#00E5FF"), // Cyan spark
        hexColor("#6366F1"), // Indigo bridge
        hexColor("#D946EF")  // Fuchsia tip
    ] as CFArray
    let centerGrad = CGGradient(colorsSpace: colorSpace, colors: centerColors, locations: [0.0, 0.5, 1.0])!

    ctx.saveGState()
    // Inner overlap shadow to give luxurious 3D depth
    ctx.setShadow(offset: CGSize(width: -6, height: 6), blur: 16, color: hexColor("#000000", alpha: 0.5))
    ctx.addPath(pathCenter)
    ctx.clip()
    ctx.drawLinearGradient(centerGrad, start: CGPoint(x: 375, y: 580), end: CGPoint(x: 805, y: 444), options: [])
    ctx.restoreGState()

    // ── 4. Elegant Core Spark: AI Spark / Star at the forward focal point ──
    let starCenter = CGPoint(x: 550, y: 512)
    let starPath = CGMutablePath()
    let starR: CGFloat = 36
    let starInner: CGFloat = 8

    for i in 0..<8 {
        let angle = CGFloat(i) * CGFloat.pi / 4.0 - CGFloat.pi / 2.0
        let r = (i % 2 == 0) ? starR : starInner
        let pt = CGPoint(x: starCenter.x + cos(angle) * r, y: starCenter.y + sin(angle) * r)
        if i == 0 { starPath.move(to: pt) }
        else { starPath.addLine(to: pt) }
    }
    starPath.closeSubpath()

    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: 18, color: hexColor("#00F2FE", alpha: 0.9))
    ctx.addPath(starPath)
    ctx.setFillColor(hexColor("#FFFFFF", alpha: 0.95))
    ctx.fillPath()
    ctx.restoreGState()

    ctx.restoreGState() // Restore from scale

    return ctx.makeImage()
}

func savePNG(image: CGImage, to url: URL) {
    let rep = NSBitmapImageRep(cgImage: image)
    guard let data = rep.representation(using: .png, properties: [:]) else {
        print("Failed to get PNG data")
        return
    }
    do {
        try data.write(to: url)
        print("Successfully generated \(url.lastPathComponent) (\(image.width)x\(image.height))")
    } catch {
        print("Error saving to \(url): \(error)")
    }
}

// Generate all assets
let currentDir = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let assetsDir = currentDir.appendingPathComponent("assets")

// 1. icon.png (1024x1024 with full background)
if let icon = createFastArtIcon(size: 1024, transparentBg: false) {
    savePNG(image: icon, to: assetsDir.appendingPathComponent("icon.png"))
}

// 2. fastart_logo.png (1024x1024 with background)
if let logo = createFastArtIcon(size: 1024, transparentBg: false) {
    savePNG(image: logo, to: assetsDir.appendingPathComponent("fastart_logo.png"))
}

// 3. adaptive-icon.png (1024x1024 transparent foreground for Android adaptive icon)
if let adaptive = createFastArtIcon(size: 1024, transparentBg: true) {
    savePNG(image: adaptive, to: assetsDir.appendingPathComponent("adaptive-icon.png"))
}

// 4. splash-icon.png (1024x1024 transparent foreground for Splash screen)
if let splash = createFastArtIcon(size: 1024, transparentBg: true) {
    savePNG(image: splash, to: assetsDir.appendingPathComponent("splash-icon.png"))
}

// 5. favicon.png (48x48 web tab icon)
if let favicon = createFastArtIcon(size: 48, transparentBg: false) {
    savePNG(image: favicon, to: assetsDir.appendingPathComponent("favicon.png"))
}

print("All FastArt brand assets generated successfully!")

