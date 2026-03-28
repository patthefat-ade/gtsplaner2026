'''
# Feature-Branch-Strategie für gts-planer-2026

Dieses Dokument beschreibt die empfohlene Git-Branching-Strategie für die Entwicklung des gts-planer-2026 Projekts. Ziel ist es, einen strukturierten und nachvollziehbaren Entwicklungsprozess zu gewährleisten, der die Zusammenarbeit im Team erleichtert und die Code-Qualität sichert.

## 1. Übersicht der Branches

Wir verwenden ein vereinfachtes Modell, das an [GitFlow](https://nvie.com/posts/a-successful-git-branching-model/) angelehnt ist, mit den folgenden Haupt-Branches:

| Branch | Zweck |
|:---|:---|
| `main` | Enthält ausschließlich produktionsreifen Code. Jeder Commit auf `main` ist ein stabiles Release und wird automatisch auf die Produktionsumgebung deployed. Direkte Commits auf `main` sind untersagt. |
| `develop` | Dient als primärer Integrations-Branch für neue Features. Alle Feature-Branches werden in `develop` gemerged. Dieser Branch sollte jederzeit stabil und testbar sein. Nächtliche Builds und Deployments auf die Staging-Umgebung erfolgen von `develop`. |
| `feature/*` | Jeder neue Fitur oder Bugfix wird in einem eigenen `feature`-Branch entwickelt. Dies isoliert die Änderungen und erleichtert Code-Reviews. |

## 2. Workflow

Der Entwicklungsprozess für ein neues Feature (oder einen Bugfix) folgt diesen Schritten:

### Schritt 1: Issue erstellen

Vor Beginn der Entwicklung wird ein [GitHub Issue](https://github.com/hilfswerk/gts-planer-2026/issues) erstellt, das die Anforderungen, Ziele und Akzeptanzkriterien des Features beschreibt. Das Issue erhält eine eindeutige Nummer (z.B., `#188`).

### Schritt 2: Feature-Branch erstellen

Basierend auf dem `develop`-Branch wird ein neuer `feature`-Branch erstellt. Der Name des Branches folgt einem klaren Muster, um die Zuordnung zum Issue zu erleichtern:

```bash
git checkout develop
git pull
git checkout -b feature/#188-devops-feature-branch-strategie
```

**Namenskonvention:** `feature/<issue-nummer>-<kurzbeschreibung>`

- Die Kurzbeschreibung sollte in Kleinbuchstaben und mit Bindestrichen getrennt sein.
- Dies ermöglicht eine direkte Verknüpfung vom Branch zum Issue.

### Schritt 3: Entwicklung und Commits

Die Entwicklung findet ausschließlich im `feature`-Branch statt. Commits sollten atomar sein und klare, prägnante Commit-Messages haben. Es wird empfohlen, die Commit-Messages mit der Issue-Nummer zu referenzieren:

```bash
git commit -m "feat(#188): Add initial documentation for branch strategy"
```

Regelmäßige Pushes auf den Remote-Branch sichern die Arbeit und machen den Fortschritt für das Team sichtbar:

```bash
git push --set-upstream origin feature/#188-devops-feature-branch-strategie
```

### Schritt 4: Pull Request (PR) erstellen

Sobald das Feature fertig entwickelt und lokal getestet ist, wird ein **Pull Request** (PR) von `feature`-Branch nach `develop` erstellt.

- Der PR-Titel sollte das Issue referenzieren (z.B., `feat(#188): DevOps Feature-Branch-Strategie`).
- In der PR-Beschreibung wird das implementierte Feature kurz zusammengefasst und auf das zugehörige Issue verlinkt (`Closes #188`).
- Mindestens ein Reviewer aus dem Entwicklungsteam muss dem PR zugewiesen werden.

### Schritt 5: Code-Review und automatisierte Checks

Der Reviewer prüft den Code auf Qualität, Lesbarkeit und die Einhaltung der Projektstandards. Parallel dazu laufen automatisierte CI-Checks (Continuous Integration):

- **Linting & Formatting:** Code-Stil wird überprüft.
- **Unit & Integration Tests:** Alle Tests müssen erfolgreich durchlaufen.
- **Build-Prozess:** Die Anwendung muss erfolgreich gebaut werden können.

Feedback aus dem Review wird im `feature`-Branch umgesetzt und gepusht, wodurch der PR automatisch aktualisiert wird.

### Schritt 6: Merge in `develop`

Nach erfolgreichem Review und bestandenen CI-Checks wird der PR vom Reviewer oder dem Autor in den `develop`-Branch gemerged. Es sollte ein **Squash-Merge** bevorzugt werden, um die Git-Historie von `develop` sauber und übersichtlich zu halten. Der `feature`-Branch wird nach dem Merge automatisch gelöscht.

### Schritt 7: Release und Merge in `main`

Für ein neues Release wird ein PR von `develop` nach `main` erstellt. Dieser PR bündelt alle neuen Features seit dem letzten Release. Nach einem finalen Review wird dieser PR gemerged, was den Release-Prozess und das Deployment in die Produktion auslöst.

## 3. Fazit und Empfehlung

Die Einführung einer Feature-Branch-Strategie ist für das `gts-planer-2026` Projekt **dringend zu empfehlen**. Sie bietet folgende Vorteile:

- **Isolation:** Die Entwicklung neuer Features beeinflusst nicht den Haupt-Integrations-Branch (`develop`).
- **Kollaboration:** Mehrere Entwickler können parallel an unterschiedlichen Features arbeiten, ohne sich gegenseitig zu blockieren.
- **Code-Qualität:** Jeder Code wird vor der Integration durch Code-Reviews und automatisierte Tests geprüft.
- **Nachvollziehbarkeit:** Die Git-Historie bleibt sauber und jede Änderung kann auf ein spezifisches Issue zurückgeführt werden.

Diese Strategie ist ein etablierter Standard in der professionellen Softwareentwicklung und wird die Stabilität und Wartbarkeit des Projekts signifikant verbessern.
'''
