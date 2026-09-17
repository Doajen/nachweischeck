# Nachweischeck für die Kanzlei

Stand dieser Anleitung: siehe Fußzeile der HTML-Datei (`Version · Stand`).

## Was die Datei ist

`nachweischeck.html` ist **eine einzige HTML-Datei**. Sie enthält Text, Layout, Rechenlogik und die hinterlegte Rechtsgrundlage vollständig in sich. Kein Server, keine Datenbank, kein Login, kein Kontaktformular.

Die Datei erklärt einem Mandanten in wenigen Minuten:

1. welcher gesetzliche AfA-Satz nach § 7 Abs. 4 Satz 1 Nr. 2 EStG für sein Fertigstellungsjahr gilt,
2. dass § 7 Abs. 4 Satz 2 EStG bei geeignetem **Nachweis** eine kürzere tatsächliche Nutzungsdauer zulässt,
3. ob es überhaupt plausibel ist, dazu einen Gutachter zu fragen (Prüfen / Unsicher / Oft unwirtschaftlich),
4. und was ein Energieausweis ist, wenn es um Verkauf, Neuvermietung oder Miete geht.

Alle Eingaben bleiben im Browser des Nutzers. Es werden **keine Objektdaten** übertragen — weder an die Kanzlei noch an den Betreiber. Es gibt keine Cookies, kein Tracking, keine Analyse-Pixel. Standardmäßig wird auch nichts lokal gespeichert.

## Was die Datei nicht tut

- Sie **stellt keine Restnutzungsdauer fest**. Die angezeigten Szenarien ND 30 / 25 / 20 sind ausdrücklich benannte Rechenbeispiele, keine Aussage über das Gebäude des Mandanten.
- Sie ist **kein Nachweis** im Sinne des § 7 Abs. 4 Satz 2 EStG. Ein Szenario auf einer Homepage ersetzt kein Gutachten.
- Sie ist **keine Steuerberatung**, keine Bewertung und keine Einzelfallauskunft.
- Sie nennt **keine Erfolgsaussichten und keine Anerkennungsquoten**.
- Sie fragt **keine personenbezogenen Daten** ab: keine Adresse, keine PLZ, keinen Namen, keine E-Mail, kein Einkommen.
- Sie behandelt **nicht** Denkmal-AfA (§ 7i, § 10f EStG), § 7b EStG, die QNG-Förderung, § 35c EStG und die degressive AfA nach § 7 Abs. 5a EStG.

Euro-Beträge erscheinen nur, wenn der Nutzer **selbst** Beträge einträgt (Gebäudeanteil, Grenzsatz, Honorar). Ohne Eingabe bleiben diese Spalten leer — es wird kein Steuersatz und kein Honorar unterstellt.

## Öffnen und weitergeben

Die Datei läuft ohne Internetverbindung:

- **Doppelklick** — öffnet im Standardbrowser (`file://…`). Funktioniert auch von USB-Stick.
- **Per E-Mail** — als Anhang versenden; der Empfänger öffnet sie ebenso per Doppelklick.
- **Eigener Webspace** — Datei auf den Static-Host hochladen, z. B. `https://ihre-kanzlei.de/nachweischeck.html`.

### Kanzleiname einsetzen

Der Name kommt über den Query-Parameter `?name=` und wird **nicht** in die Datei gebacken:

```
nachweischeck.html?name=Kanzlei%20Müller
```

Leerzeichen als `%20`, Umlaute funktionieren direkt. Der Name erscheint dann in der Kopfzeile und die Fußzeile ergänzt automatisch den Provisionshinweis (siehe unten).

Ohne `?name=` zeigt die Kopfzeile nur „Nachweischeck“. Für einen dauerhaften Link legen Sie sich ein Lesezeichen mit dem Parameter an oder verlinken so von Ihrer Website.

## Wo Werbung sitzt — und wem die Provision zusteht

Die Datei enthält Links zu externen Anbietern (Nutzungsdauer-Gutachten, Kaufpreisaufteilung, Energieausweis). Diese Links sind ausnahmslos gekennzeichnet:

- Über jedem Link steht **„Anzeige / Werbung“**.
- Darunter steht: **„Vertrag nur mit dem Anbieter. Tool-Anbieter kann Provision erhalten.“**

Werbung erscheint **nur** an diesen Anbieter-Zeilen. Der erklärende Text, das Lagebild und die Rechenbeispiele sind werbefrei.

**Wichtig:** Eine etwaige Provision steht dem Tool-Anbieter zu, **nicht der Kanzlei**. Wird ein Kanzleiname über `?name=` gesetzt, weist die Fußzeile das ausdrücklich aus:

> Bereitgestellt zur Orientierung durch «Name». Etwaige Provisionen stehen dem Tool-Anbieter zu, nicht der Kanzlei.

Die Kanzlei darf die Provision nicht vereinnahmen. Bitte schließen Sie dazu keine eigene Affiliate-Vereinbarung über diese Datei ab und verändern Sie die Anbieter-Links nicht.

Ist ein Anbieter-Hinweis in Ihrem Kontext unerwünscht, verwenden Sie die Datei nicht oder sprechen Sie den Betreiber auf eine werbefreie Variante an.

## Aktualisierung

Die Datei ist bewusst statisch: sie lädt nichts nach und aktualisiert sich nicht selbst. Sichtbar ist der Stand in der Fußzeile, z. B. `2026.09.1 · 2026-09-15`.

Ändert sich die Rechtslage oder der hinterlegte Stand, erhalten Sie **eine neue HTML-Datei**. Ersetzen Sie dann die alte Datei und löschen Sie ältere Kopien auf USB-Sticks und im Webspace, damit kein veralteter Stand im Umlauf bleibt. Ein Abgleich anhand der Fußzeile genügt.

## Drucken als Gesprächsnotiz

Die Druckansicht ist auf ein Gesprächsprotokoll ausgelegt. Gedruckt werden:

- die gewählte Rolle und die eingetragenen Angaben,
- das Lagebild mit den vier Sätzen und der Einordnung,
- die Rechenbeispiele einschließlich Tabelle,
- Version und Stand sowie die Haftungssätze,
- der Abschnitt „Rechtslage (RND)“.

Nicht gedruckt werden Bedienelemente, Auswahlkarten, Glossar-Schaltflächen und die anklickbaren Werbelinks. Statt eines Links erscheint im Druck nur der Anbietername mit dem Zusatz „Anzeige / Werbung“ — die Kennzeichnung bleibt also auch auf Papier erhalten, ohne dass das Blatt als Werbeflyer wirkt.

Empfehlung: als PDF drucken und zur Akte nehmen. So ist dokumentiert, welche Angaben zu welchem Stand besprochen wurden.
