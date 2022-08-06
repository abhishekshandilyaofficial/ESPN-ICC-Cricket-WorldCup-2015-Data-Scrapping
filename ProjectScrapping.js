//npm install minimist - helps extract data from the array in console.
//npm install axios - helps in downloading data from web
//npm install jsdom - It downloads html and makes DOM for out program
//npm install excel4node - It helps making excel workbook and sheets
//npm install pdf-lib - It helps making pdf
//node ProjectScrapping.js --excel=worldcup.xlsx --dataFolder=data --source="https://www.espncricinfo.com/series/icc-cricket-world-cup-2014-15-509587/match-results"
let fs=require("fs");
let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let excel4node = require("excel4node");
let pdf = require("pdf-lib");
let path = require("path");
let args = minimist(process.argv);
let responseKaPromise = axios.get(args.source);
responseKaPromise.then(function(response){
    let html = response.data;
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;
    let matches = [];
    let matchScoreDiv = document.querySelectorAll("div.ds-px-4.ds-py-3");
    for(let i = 0; i < matchScoreDiv.length; i++){
        let match = {
            t1 : " ",
            t2 : " ",
            t1s : " ",
            t2s : " ",
            result : " "
        }
        let teamParas = matchScoreDiv[i].querySelectorAll("p.ds-text-tight-m.ds-font-bold.ds-capitalize");
        
       //Making Matches.json
       match.t1 = teamParas[0].textContent;
       match.t2 = teamParas[1].textContent;
        let scoreSpans = matchScoreDiv[i].querySelectorAll("div.ds-text-compact-s.ds-text-typo-title strong"); 
        if(scoreSpans.length == 2)
        {
            match.t1s = scoreSpans[0].textContent;
            match.t2s = scoreSpans[1].textContent;
        }
        else if(scoreSpans.length == 1)
        {
            match.t1s = scoreSpans[0].textContent;
            match.t2s = "";
        }
        else
        {
            match.t1s = "";
            match.t2s = "";
        }
        let resultSpan = matchScoreDiv[i].querySelector("p.ds-text-tight-s.ds-font-regular.ds-truncate.ds-text-typo-title > span");
        match.result = resultSpan.textContent;
        matches.push(match);
    }
    let matchesKaJSON = JSON.stringify(matches);
    fs.writeFileSync("matches.json", matchesKaJSON, "utf-8")

    let teams = [];
    //Push team in teams, if not already there.
    for(let i = 0; i < matches.length; i++){
        putTeamInTeamsArrayIfMissing(teams, matches[i].t1);
        putTeamInTeamsArrayIfMissing(teams, matches[i].t2);
    }
   
    //Push match in appropriate teams
    for(let i = 0; i < matches.length; i++){
        pushMatchInAppropriateTeams(teams, matches[i].t1, matches[i].t2, matches[i].t1s, matches[i].t2s, matches[i].result);
        pushMatchInAppropriateTeams(teams, matches[i].t2, matches[i].t1, matches[i].t2s, matches[i].t1s, matches[i].result);
    }

    //Making teams.json
    let teamsKaJSON = JSON.stringify(teams);
    fs.writeFileSync("teams.json", teamsKaJSON, "utf-8");


    //Making Excel File
    createExcelFile(teams);
    //Making Folders of teams
    prepareFolderAndPdfs(teams, args.dataFolder)
})
function putTeamInTeamsArrayIfMissing(teams, teamName){
    for(let i = 0; i < teams.length; i++){
       
        if(teams[i].name == teamName){
            return;
        }
    } 
    let team = {
        name : teamName,
        matches:[]
    };
    teams.push(team);
}
function pushMatchInAppropriateTeams(teams, homeTeam, oppTeam, selfScore, oppScore, result){
    let idx = -1;
    for(let i = 0; i < teams.length; i++){
        if(teams[i].name == homeTeam){
            idx = i;
            break;
        }
    } 
    let team = teams[idx];
    team.matches.push({
        vs : oppTeam,
        selfScore : selfScore,
        oppScore : oppScore,
        result : result
    });
}
function createExcelFile(teams){
    let wb = new excel4node.Workbook();
    for(let i = 0; i < teams.length; i++){
        let sheet = wb.addWorksheet(teams[i].name);

        sheet.cell(1,1).string("vs");
        sheet.cell(1,2).string("Self Score");
        sheet.cell(1,3).string("opp Score");
        sheet.cell(1,4).string("Result");
        for(let j = 0; j < teams[i].matches.length; j++){
        sheet.cell(2+j,1).string(teams[i].matches[j].vs);
        sheet.cell(2+j,2).string(teams[i].matches[j].selfScore);
        sheet.cell(2+j,3).string(teams[i].matches[j].oppScore);
        sheet.cell(2+j,4).string(teams[i].matches[j].result);
        }
    }
    wb.write(args.excel);
}
function prepareFolderAndPdfs(teams, dataDir){
    if(fs.existsSync(dataDir) == true){
        fs.rmdirSync(dataDir, {recursive : true});
    }
    fs.mkdirSync(dataDir);
    for(let i = 0; i < teams.length; i++){
        let teamFolderName = path.join(dataDir, teams[i].name);
        fs.mkdirSync(teamFolderName);
        
        for(let j = 0; j < teams[i].matches.length; j++){
            let match = teams[i].matches[j];
            createMatchScoreCardPdf(teamFolderName,teams[i].name, match);
        }
    }
    
}
function createMatchScoreCardPdf(teamFolderName, homeTeam, match){
    let matchFileName = path.join(teamFolderName, match.vs);
    let templateFileBytes = fs.readFileSync("Template.pdf");
    let pdfdocKaPromise = pdf.PDFDocument.load(templateFileBytes);
    pdfdocKaPromise.then(function(pdfdoc){
        let page = pdfdoc.getPage(0);
        page.drawText(homeTeam,{
            x: 320, 
            y: 690,
            size: 12
        });
        page.drawText(match.vs,{
            x: 320, 
            y: 662,
            size: 12
        });
        page.drawText(match.selfScore,{
            x: 320, 
            y: 630,
            size: 12
        });
        page.drawText(match.oppScore,{
            x: 320, 
            y: 597,
            size: 12
        });
        page.drawText(match.result,{
            x: 320, 
            y: 565,
            size: 12
        });

        let changedBytesKaPromise = pdfdoc.save();
        changedBytesKaPromise.then(function(changedBytes){
           if(fs.existsSync(matchFileName+".pdf") == true){
                fs.writeFileSync(matchFileName+"2.pdf", changedBytes);
           } else{
            fs.writeFileSync(matchFileName+".pdf", changedBytes);
           }
        })
    })
}