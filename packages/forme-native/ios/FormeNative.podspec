require 'json'
package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))
Pod::Spec.new do |s|
  s.name = 'FormeNative'
  s.version = package['version']
  s.summary = 'Native Forme PDF renderer and font subsetter'
  s.description = s.summary
  s.license = 'MIT'
  s.author = 'Rezumi'
  s.homepage = 'https://github.com/alfariesh/rezumi'
  s.platforms = { :ios => '17.4' }
  s.source = { :git => 'https://github.com/alfariesh/rezumi.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.swift', 'include/*.h'
  s.public_header_files = 'include/*.h'
  s.vendored_frameworks = 'FormeNative.xcframework'
  s.libraries = 'c++', 'z', 'resolv'
end
