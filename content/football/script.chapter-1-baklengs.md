// chapter-1-baklengs, written as prose. The chapter JSON is compiled from
// this file and is what the engine loads.
//
//     python tools/author.py content/football/script.chapter-1-baklengs.md --check
//     python tools/author.py content/football/script.chapter-1-baklengs.md --write
//     python tools/narrate.py --chapter football/chapter-1-baklengs --lang no
//
// REGISTERET STÅR I outline.md SIN `# for whom` OG DET ER BINDENDE.
// Leseren er en voksen akademiker som har sett fotball og aldri fått
// apparatet forklart. Konkret, for hver setning her:
//
//   Ingenting om selve spillet forklares. Elleve på hver side, nitti
//   minutter, et mål teller ett. Aldri en setning som forutsetter noe annet.
//   Ingen oppbygging mot en avsløring, ingen retoriske spørsmål.
//   Ingen definisjonslinjer. Et fagord forklares i bisetningen som trenger
//   det. Testen: kan to avsnitt bytte plass uten tap, er dette en liste.
//   Abstraksjon forutsettes. `dominant strategi` trenger ingen forklaring;
//   `frispilling bakfra` gjør det.
//
// To tidligere utkast ble forkastet på nøyaktig dette punktet. Det første
// brukte ni og et halvt minutt på at en bane er stor; det andre var en
// ordliste lest høyt. Begge ble lest slik de fortjente.
//
// HVER SCENE SETTER OPP BANEN PÅ NYTT — en scenebytte tømmer stagen.

---
id: chapter-1-baklengs
pack: football
title: Hvorfor de spiller baklengs | Why they pass backwards
subtitle: En setning lovtekst fra 1992, og regnestykket den skapte | One sentence of law from 1992, and the arithmetic it created
---

# ending
say: Én regel, tre trekk, og hvert svar lagde problemet som avlet det neste. Det er formen på resten av kurset. | One law, three moves, and every answer made the problem that bred the next. That is the shape of the rest of the course.
figure.value: 1992
figure.label: året keeperen ble en utespiller | the year the goalkeeper became an outfield player

## Ingen dominant strategi | No dominant strategy
bed: none

{pitch.show full} Dette er et kurs om moderne fotballtaktikk.
> This is a course about modern football tactics.
Det starter med en påstand som lar seg bevise: det finnes ingen dominant strategi i fotball.
> It starts from a claim that can be proved: there is no dominant strategy in football.

{pitch.team team shape=4-3-3 line=34 over=1.2} Det er derfor faget har en historie i det hele tatt.
> That is why the subject has a history at all.
Hadde det fantes et beste oppsett, ville noen funnet det rundt nitten femti, og resten hadde kopiert det.
> If there were a best arrangement, somebody would have found it around 1950 and the rest would have copied it.
{pitch.team opponent shape=4-4-2 line=30 over=1.2} I stedet beveger taktikk seg i sykluser, der hvert svar lager problemet som avler det neste.
> Instead tactics move in cycles, where every answer creates the problem that breeds the next one.

Dette kapitlet tar det klareste eksempelet vi har på hvordan en slik syklus starter.
> This chapter takes the clearest example we have of how one of those cycles starts.
Den startet ikke med en trener. Den startet med én setning lovtekst.
> It did not start with a coach. It started with one sentence of law.

## 1992 | 1992
bed: none

{pitch.show own-half} {pitch.team team shape=4-3-3 line=13 depth=20} Sommeren nittentonittito bestemte IFAB at en keeper ikke lenger kunne ta ballen med hendene når en medspiller hadde spilt den til ham med foten. {mark term:tilbakespillsregelen}
> In the summer of 1992 the IFAB ruled that a goalkeeper could no longer handle the ball when a team-mate had passed it to him with his foot. {^}
Begrunnelsen var tidsspille. VM i Italia to år før hadde endt på to komma to mål per kamp, det laveste snittet i noe sluttspill.
> The stated reason was time-wasting. The World Cup in Italy two years earlier had finished on 2.2 goals a game, the lowest average of any tournament.

{pitch.ball gk side=team} Effekten hadde ingenting med hensikten å gjøre.
> The effect had nothing to do with the intention.
Keeperen måtte lære å spille med føttene, og i det han kunne det, var han en ellevte utespiller.
> Goalkeepers had to learn to play with their feet, and the moment they could, he was an eleventh outfield player.

{pitch.team opponent shape=4-4-2 line=50 depth=28 over=1.2} Og det gjør regnestykket i egen tredjedel entydig.
> And that makes the arithmetic in your own third unambiguous.
Motstanderen kan ikke presse med alle. Presser de med tre, og du bygger med to midtstoppere og keeperen, er det tre mot tre og ingen er fri.
> The opposition cannot press with everybody. If they press with three and you build with two centre-backs and the goalkeeper, it is three against three and nobody is free.
{pitch.move team who=six to=[34,11] over=1.0} Trekker seksseren ned mellom stopperne, er dere fire mot tre.
> Drop the holding midfielder in between the centre-backs and it is four against three.
{pitch.move team who=six mark=true} Og den frie mannen er ikke fri et øyeblikk. Han er fri strukturelt, hele tiden, fordi tallet ikke går opp for dem.
> And the free man is not free for a moment. He is free structurally, continuously, because the number does not work for them.

{pitch.move team who=six mark=false} Å spille seg ut bakfra er derfor ikke mot. Det er å telle. {mark term:frispilling bakfra}
> So playing out from the back is not courage. It is counting. {^}
{pitch.pass gk to=lcb side=team over=0.8} Og det er en invitasjon: overtallet betyr ingenting før presset kommer, og hver spiller som løper framover legger igjen plassen han sto i. {mark term:overtall}
> And it is an invitation: the overload means nothing until the press comes, and every player who runs forward leaves behind the space he was standing in. {^}

## Motsvaret | The counter
bed: none

{pitch.show own-half} {pitch.team team shape=4-3-3 line=13 depth=20} {pitch.team opponent shape=4-4-2 line=50 depth=28} Et lag som presser høyt kan svare på det regnestykket på to måter, og bare den ene er billig.
> A team pressing high can answer that arithmetic in two ways, and only one of them is cheap.

{pitch.move opponent who=lm to=[26,24] over=1.0} Den dyre er å sende en mann til.
> The expensive one is to send another man.
Da er tallene like igjen, men noen bak er blitt fri, og risikoen ligger nå i ryggen på deg.
> Then the numbers are level again, but somebody behind is now free, and the risk sits behind you.

{pitch.team opponent shape=4-4-2 line=50 depth=28 over=1.0} Den billige er å ta bort et valg uten å bruke en spiller på det. {mark term:styringspress}
> The cheap one is to remove an option without spending a player on it. {^}
{pitch.run [34,30] to=[23,16] side=opponent bend=0.35 over=1.0} Spissen løper ikke rett mot midtstopperen, men i bue, med kroppen mellom ballen og den andre midtstopperen.
> The striker does not run straight at the centre-back but on a curve, with his body between the ball and the other centre-back.
Da presser han to spillere med én kropp. Den ene kan ikke få ballen. Den andre må ta den.
> Now he is pressing two players with one body. One of them cannot receive it. The other has to.

{pitch.clear} Det avgjør hvor kampen skal foregå, og det er meningen.
> That decides where the match will be played, which is the point.
{pitch.zone [0,0,14,40] tone=gold label=Sidelinja | The touchline over=0.9} Ballen styres ut mot sidelinja, og en spiller som mottar den der har mistet halvparten av vinklene sine før han har rørt den.
> The ball is steered out towards the touchline, and a player receiving it there has lost half his angles before he has touched it.

{pitch.pass lcb to=lb side=team over=0.7} Og der venter det andre trekket. {mark term:pressfelle}
> And there the second move is waiting. {^}
{pitch.run [26,24] to=[11,15] side=opponent over=0.7} {pitch.run [16,32] to=[9,19] side=opponent over=0.7} Pasningen ut til backen sto åpen med vilje, og lukkes i det ballen er underveis.
> The pass out to the full-back was left open on purpose, and is shut while the ball is travelling.
Tre som ankommer samtidig trenger ikke å vinne en duell. De trenger bare å fjerne utgangene.
> Three arriving at once do not need to win a duel. They only need to remove the exits.

{pitch.zoneHide} {pitch.clear} Derfor er en åpen pasning ikke nødvendigvis en gave.
> So an open pass is not necessarily a gift.
I et velorganisert press er den som regel den eneste pasningen motstanderen vil at du skal slå.
> In a well-organised press it is usually the only pass the opposition want you to play.

## Prisen | The price
bed: none

{pitch.show full} {pitch.team team shape=4-3-3 line=44 depth=34} {pitch.team opponent shape=4-4-2 line=26 depth=26} Alt dette har en pris, og den betales to steder.
> All of this has a price, and it is paid in two places.

{pitch.move team who=rb to=[56,40] over=0.9} Det første er at et lag som angriper allerede står oppstilt for at angrepet skal mislykkes. {mark term:restforsvar}
> The first is that a team attacking is already arranged for the attack to fail. {^}
{pitch.move team who=lb to=[10,72] over=0.9} Den ene backen går opp. Den andre blir stående. {pitch.move team who=six to=[34,44] over=0.9} Seksseren holder seg mellom ballen og eget mål, ikke bak ballen.
> One full-back goes forward. The other stays. {^} The holding midfielder keeps himself between the ball and his own goal, not behind the ball.
Det er ikke pessimisme. Det er den delen av angrepsplanen som handler om det mest sannsynlige utfallet.
> That is not pessimism. It is the part of the attacking plan that deals with the most likely outcome.

{pitch.line 44 label=Forsvarslinja | The defensive line tone=blue} Det andre er høyden på forsvarslinja. {mark term:linje}
> The second is the height of the defensive line. {^}
{pitch.line 58 over=1.2} Skal overtallet bakfra bety noe, må laget skyve seg fram — og da ligger det tretti eller førti meter gress bak den siste forsvareren.
> If the overload at the back is to mean anything the team has to push up — and then there are thirty or forty metres of grass behind the last defender.

{pitch.move team who=gk to=[34,34] over=1.2} Noen må dekke det gresset, og det er keeperen. {mark term:sweeper-keeper}
> Somebody has to cover that grass, and it is the goalkeeper. {^}
Tretti år etter en regel som skulle stoppe tidsspille, er hans jobb blitt to jobber som trekker i hver sin retning: stå på streken og redde skudd, eller stå tretti meter ute og komme først til en ball i bakrommet.
> Thirty years after a law meant to stop time-wasting, his job has become two jobs that pull in opposite directions: stand on the line and save shots, or stand thirty metres out and get first to a ball played in behind.
Et lag velger hvilken av dem det vil ha mest av, og betaler for den andre.
> A team chooses which of the two it wants more of, and pays for the other.

## Syklusen | The cycle
bed: none

{pitch.show full} {pitch.team team shape=4-3-3 line=40} {pitch.team opponent shape=4-4-2 line=30} Én regelendring, og tre trekk som følger av den.
> One change in the law, and three moves that follow from it.

{pitch.move team who=six mark=true} Overtallet bakfra, som gjør presset matematisk umulig.
> The overload at the back, which makes the press mathematically impossible.
{pitch.move team who=six mark=false} {pitch.move opponent who=st mark=true} Buen i pressløpet, som gjør det mulig igjen uten å koste en mann.
> The curve in the pressing run, which makes it possible again without costing a man.
{pitch.move opponent who=st mark=false} Og fella ved sidelinja, som gjør invitasjonen til et bakhold.
> And the trap by the touchline, which turns the invitation into an ambush.

Ingen av de tre er en løsning. Hvert av dem er et svar som lager det neste problemet.
> None of the three is a solution. Each of them is an answer that makes the next problem.
Det er derfor det ikke finnes en beste plan, og det er derfor dette faget fortsatt beveger seg.
> That is why there is no best plan, and why the subject is still moving.

{pitch.team team shape=4-3-3 line=52 depth=28 compact=true over=1.6} Neste kapittel tar det øyeblikket hvor hele dette byggverket er svakest.
> The next chapter takes the moment when the whole of this structure is at its weakest.
Ikke når laget mister ballen. Når det vinner den.
> Not when the team loses the ball. When it wins it.
