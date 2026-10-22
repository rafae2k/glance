// glance-trigger — listens to the trackpad system-wide and notifies glance over stdout.
//   force  → Force Click (default)
//   double → double click
// Prints "trigger" for each gesture. Exits on its own when glance quits (stdin closes).
import AppKit

let mode = CommandLine.arguments.dropFirst().first ?? "force"

func emit(_ s: String) {
  print(s)
  fflush(stdout)
}

let app = NSApplication.shared
app.setActivationPolicy(.prohibited) // no Dock icon, never takes focus

var lastStage = 0
var monitor: Any?

switch mode {
case "double":
  monitor = NSEvent.addGlobalMonitorForEvents(matching: .leftMouseDown) { e in
    if e.clickCount == 2 { emit("trigger") }
  }
default:
  // stage 1 = normal click, stage 2 = pressed through to a Force Click
  monitor = NSEvent.addGlobalMonitorForEvents(matching: [.pressure, .leftMouseUp]) { e in
    if e.type == .leftMouseUp { lastStage = 0; return }
    if e.stage == 2 && lastStage < 2 { emit("trigger") }
    lastStage = e.stage
  }
}

FileHandle.standardInput.readabilityHandler = { h in
  if h.availableData.isEmpty { exit(0) }
}

emit("ready \(mode)")
app.run()
