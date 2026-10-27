require "json"

package = JSON.parse(File.read(File.join(__dir__, "../../package.json")))

Pod::Spec.new do |s|
  s.name         = "FastArtRust"
  s.version      = package["version"]
  s.summary      = "FastArt Native Rust Core Engine for iOS"
  s.homepage     = "https://github.com/fastart/fastart"
  s.license      = "MIT"
  s.authors      = { "FastArt Team" => "team@fastart.app" }
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.vendored_libraries = "ios/libfastart_ios.a"
  s.requires_arc = true

  s.dependency "ExpoModulesCore"
  s.dependency "React-Core"
end
