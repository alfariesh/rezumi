Pod::Spec.new do |s|
  s.name = 'KeyCommands'
  s.version = '0.0.0'
  s.summary = 'Hardware keyboard shortcuts'
  s.description = s.summary
  s.license = 'MIT'
  s.author = 'Rezumi'
  s.homepage = 'https://github.com/alfariesh/rezumi'
  s.platforms = { :ios => '17.4' }
  s.source = { :git => 'https://github.com/alfariesh/rezumi.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.swift'
  s.frameworks = 'UIKit'
end
