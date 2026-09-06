// chapter-3-rutenettet.
//
//     python tools/author.py content/football/script.chapter-3-rutenettet.md --write
//     python tools/narrate.py --chapter football/chapter-3-rutenettet --lang no
//
// Kursets teoritunge kapittel, og det tåler å være det: posisjonsspill er en
// ferdig utviklet romteori med regler, og den kan gjøres presist rede for til
// noen som er vant til abstraksjon. Se outline.md sin `# for whom`.
//
// Beviset er halvrommet, og det er en GEOMETRISK påstand man kan tegne.
// Stillheten ligger i den scenen.
//
// Kapitlet skal ikke selge teorien. Kapittel fire angriper den, og siste beat
// her skal gjøre det angrepet uunngåelig.
//
// HUSKELISTE FRA DE TO FØRSTE KAPITLENE:
//   plate.hide FØR pitch.show — et bilde ligger over banen og skjuler den
//   et bilde skal stå i 6 til 34 sekunder
//   en scene åpner ikke på et smalt utsnitt; utsnittet kommer når argumentet
//   snevrer inn
//   hver scene setter opp banen på nytt
//   bildet må vise det setningen snakker om

---
id: chapter-3-rutenettet
pack: football
title: Rutenettet | The grid
subtitle: Halvrommet, og hvorfor geometrien gir det verdien | The half-space, and why the geometry is what makes it valuable
---

# ending
say: Reglene finnes for å garantere at det alltid er en vinkel å spille i. Neste kapittel er skolen som mener at hele premisset er feil. | The rules exist to guarantee there is always an angle to play into. The next chapter is the school that thinks the whole premise is wrong.
figure.value: 5
figure.label: korridorer banen deles i | corridors the pitch is divided into

## Rutenettet | The grid
bed: bedPatient

{plate notatbok-rutenett motion=in over=22 dim=0.2 push=0.08 into=1.4} Forrige kapittel endte på at det finnes en billigere løsning enn å reagere fort.
> The last chapter ended on there being a cheaper answer than reacting quickly.
Å stå slik at ingen trenger å reagere i det hele tatt.
> Standing in such a way that nobody has to react at all.

Den løsningen har et navn, et opphav og et regelverk.
> That answer has a name, an origin and a set of rules.
Den kom fra Amsterdam til Barcelona med Cruyff, og ble et system under Guardiola. På spansk heter den juego de posición.
> It came from Amsterdam to Barcelona with Cruyff, and became a system under Guardiola. In Spanish it is called juego de posición.

{plate.hide 1.1} {pitch.show full} {pitch.lanes over=0.9} {stat 5 label=korridorer | corridors side=ball} Den begynner med å dele banen i fem loddrette korridorer. {mark term:femkanalsbanen}
> It begins by dividing the pitch into five vertical corridors. {^}
{pitch.line 35 tone=blue} {pitch.line 70 tone=blue} Og i vannrette bånd på tvers av dem.
> And into horizontal bands across them.

{stat.clear} {stat 3 label=flest i én korridor | most in one corridor side=team} {pitch.zone half-space-left tone=gold over=0.8} Så kommer reglene. Aldri mer enn tre spillere i én korridor, og aldri mer enn to i samme bånd.
> Then come the rules. Never more than three players in one corridor, and never more than two in the same band.
{stat.clear} {pitch.zoneHide} {pitch.clear} To spillere i samme rute er alltid feil, uansett hvor gode de er.
> Two players in the same square is always wrong, however good they are.

Det høres byråkratisk ut. Det er det stikk motsatte, og grunnen er ren geometri.
> That sounds bureaucratic. It is the exact opposite, and the reason is pure geometry.

## Hvorfor trekanter | Why triangles
bed: bedPatient

{pitch.show full} {pitch.team team shape=4-3-3 line=44 depth=24} {pitch.team opponent shape=4-4-2 line=40 depth=24} Se på tre spillere som står på rekke.
> Look at three players standing in a line.
{pitch.focus who=lcb,six,eight side=team} {pitch.move team who=six to=[34,50] over=0.8} {pitch.move team who=eight to=[46,50] over=0.8} {pitch.move team who=lcb to=[22,50] over=0.8} Én motstander som stiller seg midt imellom, stenger to pasninger med én kropp.
> One opponent standing in the middle shuts off two passes with one body.

{pitch.show middle} {pitch.move team who=six to=[34,58] over=0.9} Flytt den midterste ti meter fram, og de tre står i en trekant.
> Move the middle one ten metres forward and the three of them stand in a triangle.
{pitch.pass lcb to=six side=team over=0.6} {pitch.pass six to=eight side=team over=0.6} Nå stenger den samme kroppen én pasning, og den andre går.
> Now the same body shuts one pass, and the other one goes.

{pitch.focus} {pitch.clear} {pitch.show full} Det er hele regelverket i én setning: stå slik at ingen motstander kan ta to valg fra deg samtidig.
> That is the whole rulebook in one sentence: stand so that no opponent can take two options from you at once.
Alt annet i posisjonsspillet er den regelen gjentatt over hele banen, samtidig. {mark term:posisjonsspill}
> Everything else in positional play is that rule repeated across the whole pitch at once. {^}

## Halvrommet | The half-space
bed: none

// Stillheten ligger her. Dette er kapitlets bevis, og det er en geometrisk
// påstand — den fortjener å stå uten teppe under.
{plate mal-vinkel motion=in over=24 dim=0.22 push=0.08 into=1.4} Av de fem korridorene er det én som er verdt mer enn de andre, og det er ikke midten.
> Of the five corridors one is worth more than the others, and it is not the middle.

{plate.hide 1.1} {pitch.show final-third} {pitch.lanes over=0.8} {pitch.team opponent shape=4-4-2 line=8 depth=22 facing=down} Ute på kanten er målet nesten ikke der.
> Out on the flank the goal is barely there.
{pitch.zone wing-left tone=red over=0.7} Skuddvinkelen er en sprekk, og keeperen dekker den ved å stå i nærstolpen.
> The shooting angle is a slot, and the goalkeeper covers it by standing at the near post.

{pitch.zoneHide} {pitch.zone centre tone=red over=0.7} Midt foran mål er vinkelen perfekt og plassen borte. Det er der alle forsvarerne allerede står.
> Straight in front of goal the angle is perfect and the space is gone. That is where all the defenders already are.

{pitch.zoneHide} {pitch.zone half-space-left tone=gold label=Halvrommet | The half-space over=0.9} Mellom dem ligger halvrommet, og det er det eneste stedet på banen som har begge deler. {mark term:halvrom}
> Between them lies the half-space, and it is the only place on the pitch that has both. {^}
{fact term:halvrom until=8} Nok vinkel til å skyte, og nok plass til å få ballen i fred.
> Enough angle to shoot, and enough space to receive the ball unmarked.

{pitch.show their-half} Og det er verre enn som så for den som forsvarer.
> And for the defending side it is worse than that.
{pitch.focus who=lcb side=opponent} En ball inn der tvinger midtstopperen til å velge mellom to ting han vil ha samtidig: å gå ut og ta mannen, eller å bli stående i linja.
> A ball played in there forces the centre-back to choose between two things he wants at the same time: to step out and take the man, or to hold his place in the line.
{pitch.focus} {pitch.zoneHide} Går han ut, åpner han rommet bak seg. Blir han stående, får mottakeren snu med ballen.
> If he steps out he opens the space behind him. If he holds, the receiver gets to turn with the ball.

## Å isolere | Isolation
bed: bedStill

{plate tribune-hoyt motion=in over=22 dim=0.2 push=0.1 into=1.4} Reglene har en konsekvens som ser ut som det motsatte av dem.
> The rules have a consequence that looks like their opposite.
Den er lettest å se ovenfra, og den er grunnen til at et posisjonelt lag noen ganger står helt skjevt.
> It is easiest to see from above, and it is why a positional side sometimes stands completely lopsided.

{plate.hide 1.1} {pitch.show full} {pitch.team team shape=4-3-3 line=50 depth=32} {pitch.team opponent shape=4-4-2 line=30 depth=26} Et lag som er nøye med å fordele seg, samler seg med vilje på én side. {mark term:isolasjon}
> A side that is careful to spread out crowds one flank on purpose. {^}
{pitch.focus area=[0,40,24,90]} {pitch.zone wing-left tone=gold over=0.8} Fire mann i én korridor, som reglene sier man ikke skal.
> Four men in one corridor, which the rules say you may not do.

{pitch.focus} {pitch.zoneHide} Poenget er ikke å komme gjennom der. Poenget er at motstanderen må flytte seg dit.
> The point is not to get through there. The point is that the opposition have to move across.
{pitch.team opponent shape=4-4-2 line=30 depth=26 width=0.5 over=1.4} Og et lag som forskyver seg mot ballen, tømmer den andre siden.
> And a team that shifts towards the ball empties the other side.

{pitch.focus who=rw side=team} {pitch.cross [10,74] to=[60,74] side=team over=1.1} Da kommer sidebyttet, og på den andre siden står det én mann mot én. {mark term:spillvending}
> Then comes the switch, and on the far side it is one against one. {^}
{pitch.focus} {stat 20 s label=for å lage én situasjon | to manufacture one situation side=team} Det er den eneste situasjonen i etablert angrep der en teknisk spiller får lov til å improvisere, og hele oppstillingen har jobbet i tjue sekunder for å lage den.
> It is the only situation in settled attack where a technical player is allowed to improvise, and the whole arrangement has worked for twenty seconds to produce it.

## Den tredje mannen | The third man
bed: bedPatient

{stat.clear} {pitch.show their-half} {pitch.team team shape=4-3-3 line=56 depth=30} {pitch.team opponent shape=4-4-2 line=20 depth=24 facing=down} Det finnes én bevegelse til, og den er den vanskeligste å se på TV.
> There is one more movement, and it is the hardest to see on television.

{pitch.focus who=six,ten side=team} {pitch.pass six to=nine side=team over=0.6} Spiller A spiller til B, som står med ryggen mot mål og en forsvarer i ryggen.
> Player A passes to B, who has his back to goal and a defender behind him.
Alle ser på ballen. Det er hele poenget.
> Everybody watches the ball. That is the entire point.

{pitch.focus who=eight side=team} {pitch.run [46,62] to=[52,84] side=team over=0.9} Mens de gjør det, har C startet et løp han begynte før pasningen ble slått.
> While they do, C has begun a run he started before the pass was played.
{pitch.pass nine to=eight side=team over=0.6} {mark term:tredjemannsløp} B legger den videre med første berøring, og C møter ballen i fart.
> B lays it off first time, and C meets the ball at speed.

{pitch.focus} {pitch.clear} {pitch.show full} Ingen av de tre pasningene er vanskelig. Det som er vanskelig er at C måtte løpe før han visste at det ville virke.
> None of the three passes is hard. What is hard is that C had to run before he knew it would work.
Derfor er tredjemannsløpet den bevegelsen som skiller lag som har trent sammen lenge fra lag som ikke har det.
> That is why the third-man run is the movement that separates sides who have trained together a long time from sides who have not.

## Backen som går feil vei | The full-back who goes the wrong way
bed: bedStill

{plate rutenett-kjegler motion=left over=20 dim=0.18 push=0.12 into=1.4} Teoriens mest synlige konsekvens står på feil sted på banen.
> The theory's most visible consequence stands in the wrong place on the pitch.

{plate.hide 1.1} {pitch.show own-half} {pitch.team team shape=4-3-3 line=16 depth=24} {pitch.team opponent shape=4-4-2 line=48 depth=26} En back skal etter alt vi lærte i kapittel én løpe langs krittet.
> By everything chapter one taught, a full-back runs along the chalk.
{pitch.focus who=rb side=team} {pitch.move team who=rb to=[44,24] over=1.0} Denne går innover, inn i midtbanen, og blir stående der. {mark term:invertert back}
> This one goes inside, into midfield, and stays there. {^}

{pitch.focus who=six,rb,lcb,rcb side=team} Han gjør to ting samtidig, og begge er regelverket.
> He is doing two things at once, and both of them are the rulebook.
Han fyller ruta ved siden av seksseren, så korridoren har tre og ikke to.
> He fills the square beside the six, so the corridor has three in it and not two.
{pitch.focus} Og han står allerede der ballen kommer til å bli mistet, klar for de fem sekundene forrige kapittel handlet om.
> And he is already standing where the ball is going to be lost, ready for the five seconds the last chapter was about.

{pitch.show full} {pitch.move team who=lb to=[6,52] over=1.0} {pitch.focus who=lb,rb side=team} På den andre siden går backen opp langs linja i stedet.
> On the other side the full-back goes up the line instead.
{pitch.focus} Laget står ikke speilvendt, og det er ikke slurv. {mark term:asymmetrisk struktur}
> The team is not mirrored, and that is not sloppiness. {^}
Den ene siden er bygget for å holde ballen, den andre for å angripe med den.
> One side is built to keep the ball, the other to attack with it.

## Prisen | The price
bed: bedOpen

{plate skygger-lange motion=in over=22 dim=0.2 push=0.1 into=1.4} Alt dette har en kostnad, og den er ikke fysisk.
> All of this has a cost, and it is not a physical one.
Den er heller ikke taktisk. Den ligger i at reglene er kjente.
> Nor is it a tactical one. It lies in the fact that the rules are known.

{plate.hide 1.1} {pitch.show full} {pitch.team team shape=4-3-3 line=48 depth=32} {pitch.team opponent shape=4-4-2 line=30 depth=26} Et lag som følger reglene er alltid klart, og det er alltid til å regne ut.
> A side that follows the rules is always ready, and it is always predictable.
{pitch.focus who=six,eight,eight2 side=team} Motstanderen vet nøyaktig hvilke ruter som blir fylt, fordi det er de samme rutene hver gang.
> The opposition know exactly which squares will be filled, because they are the same squares every time.

{pitch.focus} Og et lag kan bruke tjue sekunder på å lage én situasjon som en enkelt spiller ødelegger ved å stå fem meter feil.
> And a side can spend twenty seconds manufacturing one situation that a single player ruins by standing five metres out of place.

Det er den innvendingen som har fått et navn og en skole.
> That objection has acquired a name and a school.
Den sier at fotball ikke er geometri i det hele tatt, men forhold mellom mennesker som står nær nok hverandre til å finne på noe.
> It says that football is not geometry at all, but relationships between people standing close enough to improvise.
Og de to beste trenerne i verden er uenige om det, akkurat nå.
> And two of the best coaches alive disagree about it, right now.
