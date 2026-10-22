// glance-trigger — ouve o trackpad no sistema todo e avisa o glance pelo stdout.
//   force  → clique pesado (Force Click), padrão
//   double → duplo clique
// Escreve "trigger" a cada gesto. Sai sozinho quando o glance fecha (stdin fecha).
import AppKit

let mode = CommandLine.arguments.dropFirst().first ?? "force"

func emit(_ s: String) {
  print(s)
  fflush(stdout)
}

let app = NSApplication.shared
app.setActivationPolicy(.prohibited) // sem Dock, sem foco

var lastStage = 0
var monitor: Any?

switch mode {
case "double":
  monitor = NSEvent.addGlobalMonitorForEvents(matching: .leftMouseDown) { e in
    if e.clickCount == 2 { emit("trigger") }
  }
default:
  // stage 1 = clique normal, stage 2 = afundou até o clique pesado
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
