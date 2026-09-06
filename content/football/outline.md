// Kursplan for football.
//
//     python tools/outline.py football
//     python tools/outline.py football --write
//
// Den vanlige linja er norsk, skrevet først; `>`-linja under er engelsk.
//
// SKREVET OM FRA BUNNEN 5. september 2026. Den forrige planen ga hvert
// kapittel et EMNE og et bevis, og det produserte et kapittel én som var en
// ordliste lest høyt. Leseren svarte: "altfor banalt og altfor barnslig ...
// jeg har sett en fotballkamp før, jeg vet det er elleve spillere ... jeg
// forventer et interessant manus som går gjennom ulike former for strategi og
// berører begrepene når de er relevante, ikke en kjedelig liste med termer".
//
// To ting er endret, og begge er strukturelle:
//
// 1. Hvert kapittel er ETT SPØRSMÅL DET ER VERDT Å SVARE PÅ, med et svar som
//    holder mekanisk. Fagordene — over tretti i dette kurset — kommer inne i
//    argumentene, i bisetninger, der de gjør arbeid. Ingen av dem får en
//    definisjonslinje. terms.json finnes for den som vil slå opp; det er ikke
//    manus.
//
// 2. `# for whom` er en ny seksjon i formatet, fordi register viste seg å være
//    en egenskap ved KURSET og ikke ved huset. Se docs/planning.md.
//
// Planen er lagt etter et researchsøk, ikke etter hukommelse: den levende
// striden i faget akkurat nå er posisjonsspill mot relasjonsspill (Guardiola
// mot Diniz), og det er kapittel fire. Det er også det kapitlet som gjør dette
// til et kurs for en voksen og ikke en innføring.

---
pack: football
---

# question
Hvorfor står elleve spillere akkurat der de står?
> Why do eleven players stand exactly where they stand?

# about
En gjennomgang av moderne fotballtaktikk for noen som ser kamper og mangler
apparatet til å lese dem.

Utgangspunktet er en påstand som lar seg bevise: i fotball finnes det ingen
dominant strategi. Ingen plan slår alle de andre. Det er derfor ingen formasjon
noen gang har vunnet, det er derfor faget har en historie i det hele tatt, og
det er derfor en dyktig trener kan bli slått av et svakere lag som valgte den
motsatte feilen. Alt i kurset er varianter av det ene byttet: hvor lar du
rommet ligge, og hva koster det deg.

Åtte kapitler, hvert av dem ett spørsmål med et mekanisk svar. Hvorfor spiller
de baklengs til keeper under press. Hvorfor løper de framover i det de mister
ballen. Hvorfor er halvrommet den farligste sonen på banen. Om fotball best
forstås som geometri eller som relasjoner — den striden er levende akkurat nå.
Hvorfor en lav blokk er et veddemål og ikke feighet. Hvorfor hele England
flyttet en mann bakover i 1925. Hvorfor italienske lag forsvarer seg annerledes
enn engelske. Og hva en trener faktisk gjør de fem dagene ingen ser ham.

Rekkefølgen går fra det som er lettest å bevise til det som krever mest på
plass: en regelendring, så et tidsvindu, så en romteori, så motargumentet mot
den, så forsvaret mot begge, så historien — som er langt mer interessant når
man vet hva en linje og en blokk er — så en sammenligning, og til slutt
menneskene.

Rollene har ikke noe eget kapittel med vilje. En falsk nier hører hjemme i
1953, en invertert back i posisjonsspillet, en regista i relasjonsspillet og en
sweeper-keeper i regelendringen som skapte ham. Et kapittel som ramser dem opp
ville vært den samme lista i ny innpakning.

Kurset handler ikke om klubber, resultater eller enkeltspillere. Der en klubb
eller en spiller nevnes, er det som bevis.

Hva det koster, og hvem som sa ja — spørsmål 8 i docs/planning.md — avgjort
5. september 2026: null kroner. Figurene tegnes i kode på pitch-flata, stemmen
er den samme som de andre kursene bruker, og trengs det bilder eller lyd, lages
de lokalt i LM Studio. Ingen betalt tjeneste, ingen API-nøkkel.
> A run through modern football tactics for somebody who watches matches and
> lacks the apparatus to read them.
>
> It starts from a claim that can be proved: in football there is no dominant
> strategy. No plan beats all the others. That is why no formation has ever
> won, why the subject has a history at all, and why a good manager can be
> beaten by a weaker side that chose the opposite error. Everything in the
> course is a variant of one trade: where do you leave the space, and what does
> it cost you.
>
> Eight chapters, each one question with a mechanical answer. Why they pass
> backwards to the goalkeeper under pressure. Why they run forwards the instant
> they lose the ball. Why the half-space is the most dangerous ground on the
> pitch. Whether football is best understood as geometry or as relationships —
> a live argument right now. Why a low block is a bet and not cowardice. Why
> the whole of England moved a man backwards in 1925. Why Italian sides defend
> differently from English ones. And what a manager actually does on the five
> days nobody watches him.
>
> The order runs from what is easiest to prove to what needs the most in place
> first: a change in the law, then a window of time, then a theory of space,
> then the argument against it, then the defence against both, then the history
> — far more interesting once you know what a line and a block are — then a
> comparison, and finally the people.
>
> The roles deliberately have no chapter of their own. A false nine belongs in
> 1953, an inverted full-back in positional play, a regista in relationism and
> a sweeper-keeper in the rule change that created him. A chapter enumerating
> them would be the same list in new packaging.
>
> The course is not about clubs, results or individual players. Where a club or
> a player is named, it is as evidence.
>
> What it costs and who agreed — question 8 in docs/planning.md — decided on
> 5 September 2026: zero kroner. The figures are drawn in code on the pitch
> surface, the voice is the one the other courses use, and anything needing a
> picture or a sound is made locally in LM Studio. No paid service, no API key.

# for whom
En voksen akademiker som leser bredt, følger med i samfunnet, og som har sett
fotball uten noen gang å få apparatet forklart. Hun kan ingenting om taktikk og
alt om hvordan ting henger sammen.

Det styrer hver eneste setning i kurset:

Ingenting om selve spillet forklares. Det er elleve på hver side, kampen varer
nitti minutter, et mål teller ett. Skriv aldri en setning som forutsetter at
leseren ikke vet det.

Ingen oppbygging mot en avsløring. Ingen retoriske spørsmål. Ingen «det høres
ut som en fotnote, men». Et faktum står én gang og blir så brukt.

Ingen definisjonslinjer. Et fagord forklares i en bisetning inne i setningen
som trenger det, aldri som en oppføring. Testen: hvis to avsnitt kan bytte
plass uten at noe går tapt, er kapitlet en liste og det er feil.

Tempoet er en god lang artikkel, ikke en lærebok: påstand, mekanisme,
konsekvens — så videre. Leseren tåler et nytt begrep annenhver setning så lenge
hvert av dem gjør arbeid.

Abstraksjon er forventet. Avveining, likevekt, insentiv, dominant strategi og
punktert likevekt trenger ingen forklaring. Frispilling, halvrom og restforsvar
gjør det.
> An adult academic who reads widely, follows the world, and has watched
> football without ever having the apparatus explained. She knows nothing about
> tactics and everything about how things fit together.
>
> This governs every sentence in the course:
>
> Nothing about the game itself is explained. There are eleven a side, a match
> lasts ninety minutes, a goal counts one. Never write a sentence that assumes
> the reader does not know that.
>
> No building towards a reveal. No rhetorical questions. No "that sounds like a
> footnote, but". A fact is stated once and then used.
>
> No definition lines. A technical term is explained in a subordinate clause
> inside the sentence that needs it, never as an entry. The test: if two
> paragraphs could swap places without loss, the chapter is a list and it is
> wrong.
>
> The pace is a good long article, not a textbook: claim, mechanism,
> consequence — then on. The reader can take a new term every other sentence as
> long as each is doing work.
>
> Abstraction is expected. Trade-off, equilibrium, incentive, dominant strategy
> and punctuated equilibrium need no explanation. Playing out from the back,
> the half-space and rest defence do.

# not here
overgangsvindu, overgangssum, spilleragent, lønnstak | transfer window, transfer fee, agent, wage cap
dommeravgjørelse, dommertabbe, straffedrama | refereeing decision, referee error, penalty controversy
odds, tipping, spillselskap | odds, betting, gambling
tidenes beste, spillerbørs, kåring | greatest of all time, player ratings, award
barnefotball, breddefotball | youth football, grassroots

## chapter-1-baklengs
title: Hvorfor de spiller baklengs | Why they pass backwards
subtitle: En setning lovtekst fra 1992, og regnestykket den skapte | One sentence of law from 1992, and the arithmetic it created
blurb: Fram til 1992 kunne en keeper ta opp en tilbakespilt ball med hendene. Da det ble forbudt, ble han en ellevte utespiller — og et lag med ballen har siden hatt én mann mer enn motstanderen kan presse med. Alt som ser ut som dumdristighet bakfra er det regnestykket. | Until 1992 a goalkeeper could pick up a back-pass. When that was banned he became an eleventh outfield player, and a team in possession has since had one more man than the opposition can press with. Everything that looks like recklessness at the back is that sum.
langs: no, en
for: Å åpne med kursets mest avsluttede bevis, og et som ikke krever noe
     forkunnskap: én setning lovtekst endret hvordan alle angrep i verden
     begynner. Kapitlet slår fast tesen — ingen dominant strategi, bare valg om
     hvor rommet skal ligge — og beviser den med et regnestykke leseren kan
     etterprøve: med keeperen er det elleve mot ti i egen tredjedel, så et
     press er matematisk dømt med mindre det vinner ballen umiddelbart.
     Styringspresset, pressfella og restforsvaret følger som svar på det samme
     regnestykket, og sweeper-keeperen som prisen for det.
     | To open with the course's most closed piece of evidence, and one needing
     no prior knowledge: one sentence of law changed how every attack in the
     world begins. The chapter states the thesis — no dominant strategy, only
     choices about where the space sits — and proves it with a sum the reader
     can check: with the goalkeeper it is eleven against ten in your own third,
     so a press is mathematically doomed unless it wins the ball at once. The
     curved press, the pressing trap and rest defence follow as answers to the
     same sum, and the sweeper-keeper as its price.
teaches: rom, linje, ledd, formasjon, overtall, press, høyt press, frispilling bakfra, styringspress, pressfelle, restforsvar, sweeper-keeper, tilbakespillsregelen
assumes:
shows: pictures, pitch

## chapter-2-fem-sekunder
title: De fem sekundene etter | The five seconds after
subtitle: Sårbarheten bytter side i samme øyeblikk som ballen | Vulnerability changes sides at the same instant the ball does
blurb: Et lag er på sitt mest utsatte i det det VINNER ballen, ikke i det det mister den: det står i angrepsstilling og har ingenting bak seg. Derfor er den moderne reaksjonen på et balltap å løpe framover, og derfor avgjøres flere kamper i omstillingene enn i det etablerte spillet. | A team is at its most exposed the moment it WINS the ball, not when it loses it: it is standing in an attacking shape with nothing behind it. That is why the modern answer to losing possession is to run forwards, and why more matches are decided in transition than in settled play.
langs: no, en
for: Kurset innfører tid som variabel her; alt før dette handlet om rom.
     Mekanismen er presis og lar seg tegne: sårbarheten bytter side i samme
     sekund som ballen, fordi laget som nettopp vant den står oppstilt for å
     angripe og ikke for å forsvare. Gjenpress, gjennombruddshissighet og
     kontring er tre måter å bruke de samme fem sekundene på, og valget mellom
     dem er et budsjett — press koster bein man ikke har to ganger i uka.
     Kapitlet må avvise forklaringen «de er intense» og erstatte den med den
     riktige: de har regnet ut hvor ballen er billigst å vinne. Det nyeste her
     er at skillet holder på å viskes ut: rask sirkulasjon brukes nå til å
     framprovosere omstillingslignende øyeblikk inne i et etablert angrep.
     | The course introduces time as a variable here; everything before this was
     about space. The mechanism is precise and can be drawn: vulnerability
     changes sides in the same second as the ball, because the team that has
     just won it is arranged to attack and not to defend. Counter-pressing,
     vertical urgency and the counter-attack are three uses of the same five
     seconds, and choosing between them is a budget — pressing costs legs you
     do not have twice a week. The chapter must refuse the explanation "they
     are intense" and replace it with the right one: they have worked out where
     the ball is cheapest to win. The newest part is that the distinction is
     dissolving: fast circulation is now used to manufacture transition-like
     moments inside settled possession.
teaches: omstilling, gjenpress, kontring, gjennombruddshissighet, kompakthet, midtblokk, ppda
assumes: press, høyt press, rom, restforsvar, overtall, linje, frispilling bakfra
shows: pitch, pictures

## chapter-3-rutenettet
title: Rutenettet | The grid
subtitle: Halvrommet, og hvorfor geometrien gir det verdien | The half-space, and why the geometry is what makes it valuable
blurb: Posisjonsspill deler banen i fem vertikale korridorer og bestemmer hvem som får stå hvor. Det høres byråkratisk ut og er det motsatte: reglene finnes for å garantere at det alltid eksisterer en åpen pasningsvinkel. Og korridoren mellom kant og sentrum er verdt mer enn de fire andre, av grunner som er ren geometri. | Positional play divides the pitch into five vertical corridors and decides who may stand where. It sounds bureaucratic and is the opposite: the rules exist to guarantee an open passing angle always exists. And the corridor between wing and centre is worth more than the other four, for reasons that are pure geometry.
langs: no, en
for: Kursets teoritunge kapittel, og det tåler å være det: posisjonsspill er en
     ferdig utviklet romteori med regler, og den kan gjøres presist rede for på
     ti minutter til noen som er vant til abstraksjon. Beviset er halvrommet —
     en ball mottatt der tvinger keeper og midtstopper til å ville to
     forskjellige ting samtidig, og det er en geometrisk påstand man kan tegne.
     Isolasjon, spillvending, tredjemannsløp, overlapp og underlapp følger som
     verktøy innenfor samme rammeverk, og den inverterte backen som teoriens
     mest synlige konsekvens. Kapitlet skal ikke selge teorien; kapittel fire
     angriper den.
     | The theory-heavy chapter, and it can afford to be: positional play is a
     finished theory of space with rules, and it can be set out precisely in ten
     minutes to somebody used to abstraction. The proof is the half-space — a
     ball received there forces the goalkeeper and the centre-back to want two
     different things at once, and that is a geometric claim you can draw.
     Isolation, the switch, the third-man run, the overlap and the underlap
     follow as tools inside the same frame, and the inverted full-back as the
     theory's most visible consequence. The chapter must not sell the theory;
     chapter four attacks it.
teaches: posisjonsspill, halvrom, femkanalsbanen, mellomrom, bakrom, spillvending, isolasjon, tredjemannsløp, overlapp, underlapp, invertert back, asymmetrisk struktur
assumes: rom, overtall, linje, ledd, press, formasjon, kompakthet, frispilling bakfra
shows: pitch, pictures

## chapter-4-relasjon
title: Posisjon eller relasjon | Position or relation
subtitle: Den levende striden i faget | The argument the subject is having now
blurb: Mot rutenettet står en brasiliansk motposisjon: at fotball ikke er geometri, men relasjoner mellom spillere som står nær nok hverandre til å improvisere. Der Guardiola ser en spiller som trekker innover som en trafikkork, ser Diniz et overtall. Det er den samme bevegelsen, og de to teoriene er uenige om hva den er. | Against the grid stands a Brazilian counter-position: that football is not geometry but relationships between players standing close enough to improvise. Where Guardiola sees a player drifting inside as congestion, Diniz sees an overload. It is the same movement, and the two theories disagree about what it is.
langs: no, en
planned: true
for: Kapitlet som gjør dette til et kurs for en voksen og ikke en innføring.
     Striden er ekte, den pågår nå, og den har en presis form: posisjonsspill
     går fra rom til relasjon, relasjonsspill går fra relasjon til rom. Begge
     produserer overtall; de er uenige om hvor overtallet skal oppstå og om det
     kan planlegges. Det gir kurset sitt tydeligste eksempel på at ingen plan
     dominerer — to av verdens beste trenere er uenige om et førsteprinsipp, og
     begge vinner. Regista og møtende spiss hører hjemme her, som rollene et
     relasjonelt lag trenger og et posisjonelt ikke gjør. Kapitlet må avstå fra
     å kåre en vinner.
     | The chapter that makes this a course for an adult rather than a primer.
     The argument is real, it is happening now, and it has a precise shape:
     positional play moves from space towards relation, relationism moves from
     relation towards space. Both manufacture overloads; they disagree about
     where the overload should arise and whether it can be planned. It gives the
     course its clearest evidence that no plan dominates — two of the best
     coaches alive disagree about a first principle, and both win. The regista
     and the target man belong here, as the roles a relational side needs and a
     positional one does not. The chapter must decline to name a winner.
teaches: relasjonsspill, regista, møtende spiss, kombinasjonsspill, improvisasjon, spillerklynge
assumes: posisjonsspill, halvrom, mellomrom, overtall, rom, isolasjon, tredjemannsløp, formasjon, linje, press
shows: pitch

## chapter-5-blokka
title: Å nekte dem alt | Denying them everything
subtitle: Den lave blokka er et veddemål, ikke feighet | The low block is a bet, not cowardice
blurb: Mot begge teoriene finnes ett svar som virker: ta bort rommet de opererer i. Ti mann på tretti meter er nesten ubrytelig, og et lag som velger det har ikke gitt opp — det har regnet ut at motstanderens beste sjanse koster mer enn dets egen dårligste. | There is one answer to both theories that works: take away the space they operate in. Ten men in thirty metres is close to unbreakable, and a team that chooses it has not given up — it has worked out that the opposition's best chance costs more than its own worst one.
langs: no, en
planned: true
for: Motargumentet mot både tre og fire, og halve grunnen til at kurset kan
     påstå at ingen plan dominerer. Beviset er kompakthet som tall: en blokk på
     tretti meter mellom fremste og bakerste mann inneholder et tellbart antall
     pasningslinjer, og å redusere det tallet er hele jobben. Sone mot mann,
     sideforskyvning og offsidefella hører hjemme her fordi de administrerer
     det samme budsjettet, og hvert av dem har en pris kapitlet skal si høyt —
     sonen taper i overleveringene, mannsmarkeringen rives i stykker av spillere
     som bytter plass, offsidefella koster et mål hver gang den svikter.
     | The counter-argument to both three and four, and half the reason the
     course can claim no plan dominates. The proof is compactness as a number: a
     block thirty metres from front man to back contains a countable number of
     passing lanes, and reducing that number is the whole job. Zonal against
     man, shifting and the offside trap belong here because they administer the
     same budget, and each has a price the chapter must say out loud — zonal
     loses at the handovers, man-marking is torn apart by players who swap, the
     offside trap costs a goal every time it fails.
teaches: lavblokk, soneforsvar, mannsmarkering, sideforskyvning, offsidefelle, etablert angrep, pasningslinje
assumes: press, høyt press, midtblokk, kompakthet, rom, linje, ledd, halvrom, mellomrom, formasjon, posisjonsspill, relasjonsspill, overtall
shows: pitch

## chapter-6-tre-revolusjoner
title: Tre revolusjoner | Three revolutions
subtitle: 1925, 1953, 1974 | 1925, 1953, 1974
blurb: Taktikk beveger seg ikke jevnt. Den står stille i tiår og hopper så, og tre hopp forklarer resten: ett ord byttet i offsideloven i 1925, et ungarsk lag som stilte uten spiss i 1953, og et nederlandsk som byttet posisjoner med vilje i 1974. To av de tre ble utløst av jurister. | Tactics do not move smoothly. They sit still for decades and then jump, and three jumps explain the rest: one word changed in the offside law in 1925, a Hungarian side that played without a centre-forward in 1953, and a Dutch one that swapped positions on purpose in 1974. Two of the three were triggered by lawyers.
langs: no, en
planned: true
for: Historien, plassert seks og ikke én med vilje: «hele England flyttet en
     mann bakover» er en tom setning for noen som ikke vet hva en linje er, og
     en god en for noen som gjør det. Argumentet er punktert likevekt, og at
     omveltningene sjeldnere kommer fra trenere enn folk tror. Den falske
     nieren hører hjemme her, i Budapest i 1953, der den ble oppfunnet som svar
     på en engelsk stopper som ikke hadde noen å markere. Kapitlet må stå imot
     fristelsen til å bli en tidslinje: tre hendelser, hver med en mekanisme, og
     ingenting imellom.
     | The history, placed sixth and not first on purpose: "the whole of England
     moved a man backwards" is an empty sentence to somebody who does not know
     what a line is, and a good one to somebody who does. The argument is
     punctuated equilibrium, and that the upheavals come from coaches less often
     than people assume. The false nine belongs here, in Budapest in 1953, where
     it was invented as an answer to an English stopper with nobody to mark. The
     chapter has to resist becoming a timeline: three events, each with a
     mechanism, and nothing in between.
teaches: offsideregelen, pyramiden, wm-formasjonen, falsk nier, totalfotball, catenaccio, libero, 4-4-2, treerrekke, femmerrekke
assumes: formasjon, linje, ledd, offsidefelle, soneforsvar, mannsmarkering, press, posisjonsspill, relasjonsspill, rom, mellomrom
shows: pitch

## chapter-7-tre-ligaer
title: Tre ligaer, tre svar | Three leagues, three answers
subtitle: England, Spania og Italia på samme bane | England, Spain and Italy on the same pitch
blurb: De tre ligaene får samme problem og løser det ulikt: England godtar en åpen kamp for å vinne ballen høyt, Spania nekter å gi den fra seg, Italia gir den bort med vilje og gjør det til en fordel. Forskjellen er målbar, og den handler om hva hver liga belønner — ikke om hva slags folk som bor der. | The three leagues get the same problem and solve it differently: England accepts an open match in order to win the ball high, Spain refuses to give it away, Italy gives it away on purpose and makes that an advantage. The difference is measurable, and it is about what each league rewards — not about what sort of people live there.
langs: no, en
planned: true
for: Prøven på kapittel én til seks, skrevet som en prøve: en stil som ikke lar
     seg beskrive med fagordene var aldri en stil, bare en klisjé. Så: hvor høyt
     står linja, hvor mange sekunder fra balltap til skudd, hvor lange er
     angrepene, sone eller mann, og hvem bryter spillet med et taktisk frispark.
     Her hører sendingsgrafikkens tall hjemme — banetilt, PPDA, xG — fordi
     sammenligning er det de er laget for. Fella er nasjonalkarakteristikk, og
     den skal sies rett ut: ligaene har konvergert kraftig, og de mest
     ballbesittende lagene i England trenes stort sett av spanjoler.
     | The test of chapters one to six, written as a test: a style that cannot be
     described in the technical vocabulary was never a style, only a cliché. So:
     how high is the line, how many seconds from losing the ball to a shot, how
     long are the attacks, zonal or man, and who breaks the game up with a
     tactical foul. This is where the broadcast numbers belong — field tilt,
     PPDA, xG — because comparison is what they are built for. The trap is
     national character, and it should be said outright: the leagues have
     converged sharply, and England's most possession-based sides are mostly
     coached by Spaniards.
teaches: spillestil, direkte spill, banetilt, taktisk frispark, tempo, xg, sjansekvalitet
assumes: press, høyt press, midtblokk, lavblokk, gjenpress, omstilling, kontring, frispilling bakfra, posisjonsspill, relasjonsspill, halvrom, kompakthet, soneforsvar, mannsmarkering, ppda, linje, restforsvar
shows: pitch

## chapter-8-uka
title: De fem dagene ingen ser | The five days nobody watches
subtitle: Apparatet, og de nitti minuttene det ikke styrer | The staff, and the ninety minutes they do not control
blurb: En hovedtrener leder tjue til femti mennesker og har omtrent femten minutter og fem bytter til rådighet mens kampen pågår. Nesten alt du ser på lørdag ble bestemt tidligere i uka av folk med stillingstitler du aldri hører — og de fem byttene er likevel ekte beslutninger, hver av dem én av tre ting. | A head coach leads twenty to fifty people and has about fifteen minutes and five substitutions available while the match is on. Almost everything you see on Saturday was settled earlier in the week by people whose job titles you never hear — and the five changes are still real decisions, each of them one of three things.
langs: no, en
planned: true
for: Å slutte der seeren sitter, og å svare ærlig på hva som faktisk styres.
     Kapitlet har to halvdeler som skal stå mot hverandre: uka, der spilleidéen,
     motstanderrapporten, dødballtreneren og belastningsstyringen gjør nesten alt
     arbeidet — og de nitti minuttene, der treneren har svært få knapper og de
     fleste av dem ikke virker. Kampbildet binder dem sammen: samme formasjon
     betyr noe annet ved 0-0 i det trettiende minuttet enn ved 1-0 i det
     åttiende, og et bytte er alltid friske bein, en ny form, eller én bestemt
     duell.
     | To end where the viewer is sitting, and to answer honestly what is
     actually controlled. The chapter has two halves that must be set against
     each other: the week, where the game model, the opposition report, the
     set-piece coach and load management do nearly all the work — and the ninety
     minutes, where the manager has very few buttons and most of them do not
     work. Game state binds them: the same shape means something different at
     0-0 in the thirtieth minute and at 1-0 in the eightieth, and a substitution
     is always fresh legs, a new shape, or one particular duel.
teaches: kampbilde, innbytte, formasjonsbytte, troppsrotasjon, spilleidé, treningsuka, analytiker, dødballtrener, motstanderrapport, belastningsstyring, sportsdirektør
assumes: formasjon, press, høyt press, midtblokk, lavblokk, omstilling, gjenpress, frispilling bakfra, posisjonsspill, relasjonsspill, spillestil, direkte spill, xg, ppda, rom, invertert back, falsk nier
shows: pitch
