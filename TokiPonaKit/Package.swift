// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TokiPonaKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "TokiPonaKit", targets: ["TokiPonaKit"])
    ],
    targets: [
        .target(name: "TokiPonaKit"),
        .testTarget(name: "TokiPonaKitTests", dependencies: ["TokiPonaKit"])
    ]
)
