// chapter-1-baklengs, written as prose.
//
//     python tools/author.py content/football/script.chapter-1-baklengs.md --write
//     python tools/narrate.py --chapter football/chapter-1-baklengs --lang no
//     python tools/check-rhythm.py
//
// TREDJE UTKAST. De to første er verdt å huske, for de feilet på hver sin
// måte og begge gangene besto alle byggets sjekker.
//
//   Første: ni og et halvt minutt på at en bane er stor og en ball er rask.
//   "Altfor banalt og altfor barnslig ... jeg har sett en fotballkamp før."
//
//   Andre: en ordliste lest høyt. "Det er en kjedelig liste med termer."
//
//   Tredje, dette: fem og et halvt minutt riktig prosa over ETT bilde — en
//   tom grønn firkant — uten et tall på skjermen og uten musikk.
//   "Så lite engasjerende og kjedelig ... det er virkelig ikke der."
//
// docs/dramaturgy.md ble skrevet av den tredje, og tools/check-rhythm.py
// måler fire av reglene. Dette kapitlet er skrevet mot den fila:
//
//   åpner på en situasjon med noe på spill, ikke på en påstand
//   bildet skifter hvert tjuende til trettiende sekund
//   hvert tall som sies står på skjermen
//   det finnes en seng, så det finnes en stillhet å bruke — scene to
//   banen peker på det setningen snakker om (pitch.focus)
//
// Sengen står som `bed: bedPatient` på scenen og IKKE som en {music}-cue i
// første setning: kompilatoren lager cuen av scenenøkkelen, og å skrive begge
// er å be om to senger. author.py nekter, som den skal.
//
// REGISTERET STÅR I outline.md SIN `# for whom`. Voksen akademiker som ser
// fotball og aldri har fått apparatet forklart. Ingenting om selve spillet
// forklares. Ingen definisjonslinjer.
//
// HVER SCENE SETTER OPP BANEN PÅ NYTT — en scenebytte tømmer stagen.
//
// BILDET MÅ VISE DET SETNINGEN SNAKKER OM. Aapningen laa foerst paa et TOMT
// stadion under "det staar null-en, det er spilt sytti minutter", og ble lest
// med en gang: "i starten er det et tomt stadion som ikke gir mening". Bildet
// paastod at det ikke var kamp mens setningen sa at det var det. Det tomme
// stadionet er flyttet til siste beat, der kampen er over og bildet er en
// ettertanke, og benken er flyttet til samme kveld som aapningen.

---
id: chapter-1-baklengs
pack: football
title: Hvorfor de spiller baklengs | Why they pass backwards
subtitle: En setning lovtekst fra 1992, og regnestykket den skapte | One sentence of law from 1992, and the arithmetic it created
---

# ending
say: Én setning lovtekst, og tretti år senere begynner hvert eneste angrep i verden med den. Neste gang: øyeblikket hele dette byggverket er svakest. | One sentence of law, and thirty years later every attack in the world begins with it. Next: the moment this whole structure is at its weakest.
figure.value: 1992
figure.label: året keeperen ble en utespiller | the year the goalkeeper became an outfield player

## Sytti minutter | Seventy minutes
bed: bedPatient

{plate kamp-natt motion=in over=24 dim=0.22 push=0.1 into=1.4} Det står null-én. Det er spilt sytti minutter.
> It is nil-one. Seventy minutes have gone.
Laget som ligger under har hatt ballen i {stat 61% label=ballinnehav, og ingenting å vise for det | possession, and nothing to show for it side=team} sekstién prosent av kampen og ikke kommet til noe.
> The team behind have had the ball for {^} sixty-one per cent of the match and made nothing of it.

{stat.clear} Treneren har tjue minutter og fem bytter.
> The manager has twenty minutes and five substitutions.
{plate.hide 1.1} {plate benk-regn motion=left over=22 dim=0.18 push=0.14 into=1.4} Han kommer til å bruke tre av dem i løpet av de neste ti, og hvert av dem er en beslutning han kan gjøre rede for.
> He will use three of them inside the next ten minutes, and every one is a decision he could account for.

Det er den redegjørelsen dette kurset handler om.
> That accounting is what this course is about.
Etter åtte kapitler skal du kunne lese den av skjermen mens den skjer.
> After eight chapters you should be able to read it off the screen while it happens.

{plate.hide 1.1} {plate keeperfot-ball motion=in over=20 dim=0.16 push=0.08 into=1.4} Vi begynner med den minste beslutningen på banen, og den han tar rundt førti ganger i løpet av en kamp.
> We start with the smallest decision on the pitch, and one he takes about forty times a match.
Den ser ut som dumdristighet.
> It looks like recklessness.

## Pasningen som ser gal ut | The pass that looks mad
bed: bedPatient

{pitch.show own-half} {pitch.team team shape=4-3-3 line=9 depth=17} {pitch.team opponent shape=4-4-2 line=72 depth=22} {pitch.ball gk side=team} Keeperen har ballen.
> The goalkeeper has the ball.
{pitch.run st side=opponent to=[30,7] over=1.4} {pitch.run st2 side=opponent to=[44,11] over=1.6} To motstandere kommer mot ham i full fart.
> Two opponents are coming at him at speed.

{pitch.show full} {pitch.focus who=gk side=team} {pitch.pass gk to=[34,72] side=team tone=gold label=Seksti meter | Sixty metres over=1.4 carry=false} Han har hele banen foran seg og kan slå den seksti meter opp i det tomme.
> He has the whole pitch in front of him and could hit it sixty metres into space.

{pitch.show own-half} {pitch.focus who=gk,lcb side=team} {pitch.pass gk to=lcb side=team over=0.9} I stedet spiller han ti meter sidelengs, til en midtstopper som også har noen i ryggen.
> Instead he plays it ten metres sideways, to a centre-back who also has somebody behind him.
{pitch.focus} {pitch.run st2 side=opponent to=[22,9] over=0.9 tone=red} Gjør han det feil, står motstanderen alene med keeperen.
> Get it wrong and the opposition are through on goal.

Førti ganger i kampen. Hvert eneste lag i Europa. Hver helg.
> Forty times a match. Every side in Europe. Every weekend.

{pitch.clear} Det er ikke mot, og det er ikke mote.
> It is not courage, and it is not fashion.
Det er et regnestykke, og det ble mulig én sommer.
> It is a sum, and it became possible in one particular summer.

## 1992
bed: none

// STILLHETEN LIGGER HER, og det er scenens eneste virkemiddel. Sengen har
// gått under de to første scenene; her stopper den, i det lovteksten kommer.
// docs/design-direction.md ber om minst én scene per kapittel uten teppe, og
// dette er den som fortjener den.
{plate lovbok-lampe motion=in over=26 dim=0.22 push=0.08 into=1.4} Sommeren {stat 1992 label=tilbakespillsregelen | the back-pass law side=ball} nittentonittito bestemte IFAB at en keeper ikke lenger kunne ta ballen med hendene når en medspiller hadde spilt den til ham med foten. {mark term:tilbakespillsregelen}
> In the summer {^} of 1992 the IFAB ruled that a goalkeeper could no longer handle the ball when a team-mate had passed it to him with his foot. {^}

{stat.clear} Begrunnelsen var tidsspille.
> The stated reason was time-wasting.
{plate.hide 1.1} {compare part=2.21 "2,21" ball VM i Italia, 1990 | The 1990 World Cup part=2.71 "2,71" team VM i USA, 1994 | The 1994 World Cup mode=bar note=Mål per kamp. Det laveste snittet i noe sluttspill, og det neste. | Goals per game. The lowest average of any tournament, and the next one.} VM i Italia to år før hadde endt på to komma to en mål per kamp, det laveste snittet i noe sluttspill.
> The World Cup in Italy two years earlier had finished on 2.21 goals a game, the lowest average of any tournament.
Et lag som ledet kunne rulle ballen tilbake, og keeperen plukket den opp og holdt på den.
> A team in front could roll the ball back, and the goalkeeper picked it up and kept it.

{compare.clear} {plate keeperhansker motion=right over=22 dim=0.16 push=0.12 into=1.4} Effekten hadde ingenting med hensikten å gjøre.
> The effect had nothing to do with the intention.
Keeperen måtte lære seg å spille med føttene. Og i det han kunne det, var han en ellevte utespiller.
> Goalkeepers had to learn to play with their feet. And the moment they could, he was an eleventh outfield player.

## Regnestykket | The sum
bed: bedPatient

{pitch.show own-half} {pitch.team team shape=4-3-3 line=9 depth=17} {pitch.team opponent shape=4-4-2 line=47 depth=25} Et lag som presser kan ikke presse med alle. Noen må bli igjen mot dem som ikke er i oppspillet.
> A team that presses cannot press with everybody. Somebody has to stay with the players who are not in the build-up.
{pitch.focus who=st,st2 side=opponent} {stat 3 label=de presser med | they press with side=opponent} Si at de sender tre.
> Say they send three.

{stat.clear} {pitch.focus who=gk,lcb,rcb side=team} {stat 3 label=du bygger med | you build with side=team} Du bygger med to midtstoppere og keeperen. Tre mot tre, og ingen er fri.
> You build with two centre-backs and the goalkeeper. Three against three, and nobody is free.
{stat.clear} {pitch.move team who=six to=[34,7] over=1.0} {pitch.focus who=gk,lcb,rcb,six side=team} {stat 4 label=mot tre | against three side=team} Trekk seksseren ned mellom stopperne, og det er fire mot tre.
> Drop the holding midfielder in between the centre-backs and it is four against three.

{stat.clear} {pitch.focus who=six side=team} Og den frie mannen er ikke fri et øyeblikk.
> And the free man is not free for a moment.
Han er fri strukturelt, hele veien, fordi tallet ikke går opp for dem.
> He is free structurally, the whole way through, because the number does not work for them.

{pitch.focus} {pitch.show full} Det er derfor de spiller baklengs. {mark term:frispilling bakfra}
> That is why they pass backwards. {^}
{fact term:frispilling bakfra until=7} Og det er en invitasjon: overtallet betyr ingenting før presset kommer.
> And it is an invitation: the overload means nothing until the press comes.
Hver spiller som løper framover legger igjen plassen han sto i.
> Every player who runs forward leaves behind the space he was standing in.

## Motsvaret | The answer to it
bed: bedPatient

{plate taktikktavle motion=in over=22 dim=0.2 push=0.1 into=1.4} Hvis regnestykket ligger fast, må den som presser bryte det på en annen måte.
> If the sum is fixed, the side pressing has to break it some other way.
Det finnes to, og bare den ene er billig.
> There are two, and only one of them is cheap.

{plate.hide 1.1} {pitch.show own-half} {pitch.team team shape=4-3-3 line=9 depth=17} {pitch.team opponent shape=4-4-2 line=47 depth=25} Den dyre er å sende en mann til.
> The expensive one is to send another man.
{pitch.move opponent who=lm to=[26,27] over=1.0} Da er tallene like igjen — og noen bak deg er blitt fri.
> Then the numbers are level again — and somebody behind you is now free.
{pitch.focus who=rm side=opponent} Risikoen er ikke borte. Den har flyttet seg dit du ikke ser den.
> The risk has not gone. It has moved to where you cannot see it.

{pitch.focus} {pitch.team opponent shape=4-4-2 line=47 depth=25 over=1.0} Den billige er å ta bort et valg uten å bruke en spiller på det. {mark term:styringspress}
> The cheap one is to remove an option without spending a player on it. {^}
{pitch.focus who=st side=opponent} {pitch.run st to=[23,13] side=opponent bend=0.35 over=1.0} Spissen løper ikke rett mot midtstopperen, men i bue, med kroppen mellom ballen og den andre.
> The striker does not run straight at the centre-back but on a curve, with his body between the ball and the other one.
Da presser han to med én kropp. Den ene kan ikke få ballen. Den andre må ta den.
> Now he is pressing two with one body. One of them cannot receive it. The other has to.

{pitch.clear} {pitch.focus} {plate kritt-sidelinje motion=left over=20 dim=0.18 push=0.14 into=1.4} Og det avgjør hvor kampen skal foregå, som er hele poenget.
> And that decides where the match will be played, which is the entire point.
En spiller som mottar ballen ute ved sidelinja har mistet halvparten av vinklene sine før han har rørt den.
> A player receiving the ball out by the touchline has lost half his angles before he has touched it.
Han kan ikke snu unna. Streken bak ham forsvarer like godt som en mann.
> He cannot turn away. The line behind him defends as well as a man does.

{plate.hide 1.1} {pitch.show own-half} {pitch.team team shape=4-3-3 line=9 depth=17} {pitch.team opponent shape=4-4-2 line=47 depth=25} {pitch.zone [0,0,14,40] tone=gold label=Fella | The trap over=0.9} Så pasningen ut dit sto åpen med vilje. {mark term:pressfelle}
> So the pass out there was left open on purpose. {^}
{pitch.pass lcb to=lb side=team over=0.7} {pitch.run st to=[11,12] side=opponent over=0.8} {pitch.run lm to=[9,17] side=opponent over=0.8} {pitch.run lcm to=[16,22] side=opponent over=0.9} Den lukkes i det ballen er underveis, av tre som ankommer samtidig.
> It is shut while the ball is travelling, by three arriving at once.
De trenger ikke å vinne en duell. De trenger bare å fjerne utgangene.
> They do not need to win a duel. They only need to remove the exits.

## Hva det koster | What it costs
bed: bedPatient

{pitch.show full} {pitch.team team shape=4-3-3 line=44 depth=34} {pitch.team opponent shape=4-4-2 line=26 depth=26} Alt dette betales to steder, og det første er usynlig.
> All of this is paid for in two places, and the first is invisible.

{pitch.move team who=lb to=[10,72] over=0.9} {pitch.move team who=rb to=[56,40] over=0.9} Den ene backen går opp. Den andre blir stående.
> One full-back goes forward. The other stays.
{pitch.focus who=rb,six,lcb,rcb side=team} {fact term:restforsvar until=8} Mens laget angriper, står fire av dem allerede oppstilt for at angrepet skal mislykkes. {mark term:restforsvar}
> While the team attacks, four of them are already arranged for the attack to fail. {^}
Det er ikke pessimisme. Det er den delen av planen som handler om det mest sannsynlige utfallet.
> That is not pessimism. It is the part of the plan that deals with the likeliest outcome.

{pitch.focus} {pitch.line 44 label=Forsvarslinja | The defensive line tone=blue} Det andre er høyden på forsvarslinja.
> The second is the height of the defensive line.
{pitch.line 58 over=1.2} Skal overtallet bakfra bety noe, må laget skyve seg fram.
> If the overload at the back is to mean anything, the team has to push up.
Og da ligger det tretti eller førti meter gress bak den siste forsvareren.
> And then there are thirty or forty metres of grass behind the last defender.

{pitch.clear} {plate tomt-mal-natt motion=in over=22 dim=0.2 push=0.08 into=1.4} Noen må dekke det gresset.
> Somebody has to cover that grass.
{stat 30 label=meter bak siste mann | metres behind the last man side=opponent} Og den eneste som står der, er keeperen.
> And the only one standing there is the goalkeeper.

{stat.clear} Tretti år etter en regel som skulle stoppe tidsspille, er jobben hans blitt to jobber som trekker i hver sin retning.
> Thirty years after a law meant to stop time-wasting, his job has become two jobs pulling in opposite directions.
Stå på streken og redde skudd. Eller stå tretti meter ute og komme først til ballen i bakrommet.
> Stand on the line and save shots. Or stand thirty metres out and get there first.
Et lag velger hvilken av dem det vil ha mest av, og betaler for den andre.
> A team chooses which of the two it wants more of, and pays for the other.

## Tilbake til sytti | Back to seventy minutes
bed: bedPatient

{plate kamp-natt motion=right over=22 dim=0.22 push=0.12 into=1.4} Tilbake til null-én, og de tjue minuttene.
> Back to nil-one, and the twenty minutes.
Det treneren gjorde først var ikke et bytte. Han flyttet forsvarslinja fem meter fram.
> The first thing that manager did was not a substitution. He moved his defensive line five metres up.

{plate.hide 1.1} {pitch.show full} {pitch.team team shape=4-3-3 line=40 depth=32} {pitch.team opponent shape=4-4-2 line=30 depth=26} {pitch.line 40 tone=blue} Det er hele regnestykket i én bevegelse.
> That is the whole sum in one movement.
{pitch.line 52 over=1.4} Fem meter fram er ti meter mindre å spille seg gjennom, og ti meter mer å forsvare bak.
> Five metres up is ten metres less to play through, and ten metres more to defend behind.
{pitch.focus who=gk side=team} Han flyttet risikoen dit han hadde råd til den, og han satte den på keeperen.
> He moved the risk to where he could afford it, and he put it on the goalkeeper.

{pitch.focus} Det er ett trekk, og det er hele formen på faget.
> That is one move, and it is the shape of the whole subject.
Hvert svar lager problemet som avler det neste, og derfor har taktikk en historie i det hele tatt.
> Every answer makes the problem that breeds the next one, and that is why tactics have a history at all.

{pitch.clear} {pitch.teamClear} {plate tom-stadion-natt motion=in over=24 dim=0.22 push=0.1 into=1.4} Men det finnes ett øyeblikk der hele dette byggverket er svakest, og det er ikke det du tror.
> But there is one moment when this whole structure is at its weakest, and it is not the one you would guess.
Det er ikke når laget mister ballen.
> It is not when the team loses the ball.
Det er når det vinner den.
> It is when it wins it.
