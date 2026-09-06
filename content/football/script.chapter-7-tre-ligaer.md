// chapter-7-tre-ligaer.
//
// Prøven på kapittel én til seks, skrevet som en prøve. Hele poenget er
// MEKANISMEN, ikke forskjellen: en liga belønner noe, og stilen er svaret på
// belønningen. Sagt slik faller nasjonalkarakteren av seg selv, og den skal
// dessuten sies imot rett ut i scene seks.
//
// Tallene er ekte og hentet 6. september 2026:
//   mål per kamp 2024-25 — England 2,93, Italia 2,56, Spania 2,49
//   høye balltap per kamp, snitt fire sesonger — England 15,9, Spania 14,2,
//     Italia 13,5  (Opta)
//   ball i spill — Premier League 56:33 i snitt, høyest av de fem store;
//     La Liga lavest, ca. 36 sekunder under Serie A  (Opta)
//   PGMOL instruerer engelske dommere om å la spillet flyte; La Liga har
//     flere frispark, flere gule og langt flere røde enn Premier League
// Et tall som ikke står i denne lista skal ikke inn i manuset.
//
// HUSKELISTE:
//   plate.hide FØR pitch.show
//   et scene-åpningsbilde får to setninger før banen kommer
//   en scene åpner ikke på et smalt utsnitt
//   hver scene setter opp banen på nytt
//   hvert tall som sies skal på skjermen

---
id: chapter-7-tre-ligaer
pack: football
title: Tre ligaer, tre svar | Three leagues, three answers
subtitle: England, Spania og Italia på samme bane | England, Spain and Italy on the same pitch
---

# ending
say: En stil er ikke en folkekarakter. Den er svaret på hva ligaen betaler for. | A style is not a national character. It is the answer to what the league pays for.
figure.value: 3
figure.label: svar på det samme problemet | answers to the same problem

## Tre skjermer | Three screens
bed: bedOpen

{plate tre-skjermer motion=in over=22 dim=0.22 push=0.08 into=1.4} Tre kamper går samtidig på tre skjermer: en engelsk, en spansk og en italiensk.
> Three matches are running at once on three screens: one English, one Spanish, one Italian.
Lyden er av, og logoene er borte. Du skal likevel klare å si hvilken som er hvilken.
> The sound is off and the logos are gone. You should still be able to say which is which.

{plate.hide 1.1} {pitch.show full} {pitch.team opponent shape=4-2-3-1 line=18 depth=30 facing=down} {pitch.team team shape=4-3-3 line=52 depth=32} Alle tre lagene står med det samme problemet.
> All three sides are standing in front of the same problem.
{pitch.focus area=[0,60,68,105]} Motstanderen har ballen dypt på egen banehalvdel, og du vil ha den tilbake.
> The opposition have the ball deep in their own half, and you want it back.

{pitch.focus} Det finnes tre måter å svare på, og de tre ligaene har valgt hver sin.
> There are three ways to answer, and the three leagues have taken one each.
Og fella skal sies med en gang: dette handler ikke om hva slags folk som bor i de tre landene.
> And the trap should be named straight away: this is not about what sort of people live in the three countries.

## Det dommeren lar gå | What the referee lets go
bed: bedUrgent

{plate dommer-floyte motion=left over=20 dim=0.2 push=0.1 into=1.4} Begynn med England, og begynn et sted ingen begynner: hos dommeren.
> Start with England, and start somewhere nobody starts: with the referee.
Engelske dommere får beskjed om å la spillet flyte. En skulder, en dytt, en hard men ren takling — vinket videre.
> English referees are told to let the game run. A shoulder, a nudge, a hard but fair tackle — waved on.

{plate.hide 1.1} {pitch.show full} {pitch.team opponent shape=4-2-3-1 line=16 depth=28 facing=down} {pitch.team team shape=4-3-3 line=58 depth=26 compact=true} {stat 56:33 label=minutter med ballen i spill | minutes with the ball in play side=team} Konsekvensen er målbar. Ballen er i spill i femtiseks og et halvt minutt i snitt, høyest av de store ligaene.
> The consequence is measurable. The ball is in play for fifty-six and a half minutes on average, the highest of the big leagues.
{stat.clear} Et press koster arbeid, og arbeid betaler seg bare hvis kampen fortsetter å gå.
> A press costs work, and work only pays if the match keeps running.

{pitch.show their-half} {pitch.focus area=[0,58,68,105]} {pitch.run from=[34,58] to=[34,84] side=team label=Presset | The press tone=gold over=1.0} Så England presser høyt, og gjør det oftere enn noen andre.
> So England presses high, and does it more often than anybody else.
{pitch.show full} {pitch.focus} {stat 15,9 label=høye balltap per kamp | high turnovers a game side=team} Femten komma ni ganger i kampen vinnes ballen høyt oppe. Spania fjorten komma to. Italia tretten komma fem.
> Fifteen point nine times a match the ball is won high up. Spain fourteen point two. Italy thirteen point five.

{stat.clear} {stat 2,93 label=mål per kamp | goals a game side=ball} Og kampene ender med to komma ni tre mål, flest av de tre.
> And the matches end with two point nine three goals, the most of the three.
{stat.clear} {mark term:spillestil} Det er ikke temperament. Det er en tilpasning til en fløyte som ligger stille.
> That is not temperament. It is an adaptation to a whistle that stays quiet.

## Kampen som stopper | The match that stops
bed: bedPatient

{plate sol-tribune motion=in over=22 dim=0.2 push=0.08 into=1.4} Spania er det motsatte, og det begynner samme sted.
> Spain is the opposite, and it begins in the same place.
Der blir det blåst. Flere frispark enn i England, flere gule kort, og langt flere røde.
> There the whistle goes. More free kicks than in England, more yellow cards, and far more red ones.

{plate.hide 1.1} {pitch.show full} {pitch.team team shape=4-3-3 line=20 depth=34} {pitch.team opponent shape=4-4-2 line=54 depth=24 facing=down} {fact term:spillestil until=8} Regn på det som et lag. Å miste ballen er dyrt, for du får den ikke lett tilbake med kroppen.
> Do the arithmetic as a team. Losing the ball is expensive, because you cannot easily win it back with your body.
Å stoppe motstanderen med et frispark er billig, for du blir sjelden straffet hardere enn med frisparket.
> Stopping the opposition with a free kick is cheap, because you are rarely punished more heavily than the free kick itself.

{pitch.show own-half} {pitch.focus area=[0,0,68,44]} {pitch.pass from=[20,18] to=[34,30] side=team over=0.7} {pitch.pass from=[34,30] to=[50,20] side=team over=0.7} Så du beholder den. Du spiller deg ut bakfra selv når det ser ubehagelig ut.
> So you keep it. You play out from the back even when it looks uncomfortable.
{pitch.show full} {pitch.focus} {pitch.run from=[40,64] to=[34,52] side=opponent label=Frisparket | The foul tone=red over=0.8} {mark term:taktisk frispark} Og når du likevel mister den, river du ned angrepet før det rekker å bli et angrep.
> And when you do lose it, you pull the attack down before it has time to become an attack.

{fact term:taktisk frispark until=8} Det har et navn, og det er ikke et skjellsord: et taktisk frispark er et frispark du gir bort med vilje.
> It has a name, and it is not an insult: a tactical foul is a free kick you give away on purpose.
{stat 2,49 label=mål per kamp | goals a game side=ball} Prisen er en kamp som stopper hele tiden, og to komma fire ni mål — færrest av de tre.
> The price is a match that keeps stopping, and two point four nine goals — the fewest of the three.

## Å gi den bort med vilje | Giving it away on purpose
bed: bedTension

{plate benk-natt-to motion=in over=22 dim=0.2 push=0.1 into=1.4} Italia svarer med noe som ser ut som passivitet og ikke er det.
> Italy answers with something that looks like passivity and is not.
Færrest høye balltap av de tre. Ikke fordi de ikke klarer det, men fordi de ikke prøver.
> The fewest high turnovers of the three. Not because they cannot, but because they are not trying to.

{plate.hide 1.1} {pitch.show full} {pitch.team team shape=5-3-2 line=30 depth=24 compact=true} {pitch.team opponent shape=4-3-3 line=46 depth=32 facing=down} {stat 13,5 label=høye balltap per kamp | high turnovers a game side=team} Spørsmålet er ikke om du skal vinne ballen. Det er hvor.
> The question is not whether you win the ball. It is where.
{stat.clear} {pitch.focus area=[0,26,68,58]} Vinner du den høyt, står tre av deres bak deg. Vinner du den her, står seks av dem foran deg.
> Win it high and three of theirs are behind you. Win it here and six of them are in front of you.

{pitch.show middle} {pitch.focus} {pitch.run from=[34,62] to=[34,38] side=opponent tone=red over=1.2} Så du inviterer dem fram, og lar dem forplikte folk.
> So you invite them forward, and let them commit people.
{pitch.pass from=[34,34] to=[30,62] side=team label=Første pasning | The first pass tone=gold over=0.6} {pitch.pass from=[30,62] to=[42,86] side=team over=0.6} {mark term:direkte spill} Og så går ballen framover i to pasninger i stedet for ti.
> And then the ball goes forward in two passes instead of ten.

{fact term:direkte spill until=8} Det heter direkte spill, og det er en verdivurdering: fire sekunder med rot er verdt mer enn tretti sekunder med kontroll.
> It is called direct play, and it is a judgement about value: four seconds of mess is worth more than thirty seconds of control.
{stat 2,56 label=mål per kamp | goals a game side=ball} Resultatet er to komma fem seks mål. Nesten Spanias tall, fra motsatt kant.
> The result is two point five six goals. Nearly Spain's number, arrived at from the opposite side.

## Tallene ved siden av hverandre | The numbers side by side
bed: none

// Stillhet her, med vilje. Sammenligningen er kapitlets bevis, og den er det
// eneste stedet seeren skal lese tre tall samtidig uten noe annet i ørene.
{plate.hide 1.1} {compare part=15.9 "15,9" team England part=14.2 "14,2" ball Spania | Spain part=13.5 "13,5" opponent Italia | Italy mode=bar note=Høye balltap per kamp, snitt over fire sesonger. | High turnovers a game, averaged over four seasons.} Sett de tre tallene ved siden av hverandre, så sier de noe ingen av dem sier alene.
> Put the three numbers side by side and they say something none of them says alone.
England vinner ballen høyt oftest, Italia sjeldnest, og Spania ligger imellom.
> England wins the ball high most often, Italy least often, and Spain sits between them.

{compare.clear} {compare part=2.93 "2,93" team England part=2.49 "2,49" ball Spania | Spain part=2.56 "2,56" opponent Italia | Italy mode=bar note=Mål per kamp, sesongen 2024-25. | Goals a game, the 2024-25 season.} Men målene følger ikke etter i samme rekkefølge.
> But the goals do not follow in the same order.
Spania presser mer enn Italia og scorer mindre. Rekkefølgen brytes, og det er det interessante.
> Spain presses more than Italy and scores less. The order breaks, and that is the interesting part.

{compare.clear} {pitch.show full} {pitch.team team shape=4-3-3 line=52 depth=32} {pitch.team opponent shape=5-3-2 line=24 depth=22 facing=down compact=true} {mark term:banetilt} Et tredje tall forklarer hvorfor: hvor på banen ballen faktisk er.
> A third number explains why: where on the pitch the ball actually is.
{fact term:banetilt until=8} Banetilt måler hvor stor andel av berøringene i siste tredel som er dine.
> Field tilt measures what share of the touches in the final third are yours.
Et lag kan ha ballen mye og ha den på feil sted, og da er besittelsen bare arbeid.
> A side can have a lot of the ball and have it in the wrong place, and then possession is just work.

## Fella | The trap
bed: bedStill

{plate koffert-gate motion=left over=20 dim=0.2 push=0.12 into=1.4} Nå kommer setningen kapitlet er skrevet for.
> Now comes the sentence the chapter was written for.
De tre svarene er ikke tre folkeslag. De er tre sett med belønninger.
> The three answers are not three peoples. They are three sets of rewards.

En dommer som lar det gå gjør presset lønnsomt. En dommer som blåser gjør frisparket lønnsomt.
> A referee who lets it go makes pressing pay. A referee who blows makes the foul pay.
Endrer du instruksen til dommerne, endrer stilen seg innen to sesonger. Det har skjedd før.
> Change the instruction to the referees and the style changes within two seasons. It has happened before.

{plate.hide 1.1} {pitch.show full} {pitch.team team shape=4-3-3 line=44 depth=30 compact=true} {pitch.team opponent shape=4-4-2 line=14 depth=26 facing=down} Og det tydeligste beviset står i England.
> And the clearest evidence stands in England.
De mest ballbesittende lagene i Premier League trenes stort sett av spanjoler.
> The most possession-based sides in the Premier League are mostly coached by Spaniards.

De tre ligaene har nærmet seg hverandre kraftig på femten år, fordi trenerne flytter og ideene flytter med dem.
> The three leagues have converged sharply in fifteen years, because coaches move and the ideas move with them.
Sier noen at italienerne er defensive av natur, har de sagt noe om seg selv og ingenting om Italia.
> If somebody says Italians are defensive by nature, they have said something about themselves and nothing about Italy.

## Fem spørsmål på to minutter | Five questions in two minutes
bed: bedOpen

{pitch.show their-half} {pitch.team team shape=4-3-3 line=40 depth=32} {pitch.team opponent shape=4-4-2 line=12 depth=26 facing=down} {pitch.line 40 label=Hvor høyt? | How high? tone=gold} Slå på en hvilken som helst kamp, og du trenger to minutter.
> Put on any match at all, and you need two minutes.
Første spørsmål: hvor høyt står den bakerste linja når motstanderen har ballen?
> First question: how high is the last line standing when the opposition have the ball?

{pitch.show full} {pitch.focus area=[0,34,68,105]} Andre: hvor mange sekunder går det fra de mister ballen til de er samlet igjen?
> Second: how many seconds pass between them losing the ball and being organised again?
{pitch.focus} Tredje: hvor mange pasninger er det i angrepene deres — tre eller tretten?
> Third: how many passes are there in their attacks — three or thirteen?

{pitch.focus who=lcb side=opponent} Fjerde: følger forsvarerne en mann, eller følger de et stykke gress?
> Fourth: do the defenders follow a man, or do they follow a piece of grass?
{pitch.focus} {pitch.run from=[40,58] to=[34,74] side=opponent label=Femte | Fifth tone=red over=0.8} Og femte: hvem er det som river ned kontringen, og blir han irettesatt for det?
> And fifth: who is it that pulls down the counter, and is he told off for it?

{pitch.focus} De fem svarene er stilen. Alt annet er aksent.
> The five answers are the style. Everything else is accent.
Og da står bare ett spørsmål igjen: hvem er det egentlig som bestemmer noe av dette mens kampen pågår?
> Which leaves one question: who actually decides any of this while the match is going on?
