// Reproduce the existing app/public/favicon.svg sprout as an opaque iOS icon.
import AppKit
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
    bytesPerRow: size * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
context.setFillColor(NSColor(srgbRed: 0, green: 120/255, blue: 65/255, alpha: 1).cgColor)
context.fill(CGRect(x: 0, y: 0, width: size, height: size))
context.translateBy(x: 0, y: CGFloat(size))
context.scaleBy(x: CGFloat(size) / 48, y: -CGFloat(size) / 48)
context.setStrokeColor(NSColor.white.cgColor)
context.setLineWidth(3)
context.setLineCap(.round)
context.move(to: CGPoint(x: 24, y: 36))
context.addLine(to: CGPoint(x: 24, y: 22))
context.strokePath()
context.setFillColor(NSColor(srgbRed: 145/255, green: 250/255, blue: 155/255, alpha: 1).cgColor)
context.move(to: CGPoint(x: 24, y: 24))
context.addCurve(to: CGPoint(x: 34, y: 14), control1: CGPoint(x: 24, y: 18), control2: CGPoint(x: 28, y: 14))
context.addCurve(to: CGPoint(x: 24, y: 24), control1: CGPoint(x: 34, y: 20), control2: CGPoint(x: 30, y: 24))
context.fillPath()
context.setFillColor(NSColor.white.cgColor)
context.move(to: CGPoint(x: 24, y: 28))
context.addCurve(to: CGPoint(x: 16, y: 20), control1: CGPoint(x: 24, y: 23), control2: CGPoint(x: 21, y: 20))
context.addCurve(to: CGPoint(x: 24, y: 28), control1: CGPoint(x: 16, y: 25), control2: CGPoint(x: 19, y: 28))
context.fillPath()
let output = URL(fileURLWithPath: CommandLine.arguments[1])
let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(destination, context.makeImage()!, nil)
precondition(CGImageDestinationFinalize(destination))
