import datetime

maxD = datetime.datetime.now()
startWin = maxD - datetime.timedelta(days=30)
endWin = maxD

limitDay = min(endWin, datetime.datetime.now())
limitDay = limitDay.replace(hour=23, minute=59, second=59, microsecond=999000)

graphData = {}
currentDay = startWin

count = 0
while currentDay <= limitDay:
    dayKey = currentDay.strftime("%Y-%m-%d")
    graphData[dayKey] = {"freeCalls": 0, "paidCalls": 0}
    currentDay += datetime.timedelta(days=1)
    count += 1

print("Count:", count)
print("Keys:", list(graphData.keys()))
