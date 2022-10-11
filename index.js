import http, { Server } from "node:http"
import cluster from "node:cluster"
import { cpus } from "os"
import snmp from "snmp-native"
import fs from "fs"
//https://www.npmjs.com/package/node-unifi
import Unifi from "node-unifi"




/*
	Exemplo de uso de setInterval
	var a = "";
	setInterval(
		()=>{
		a+=".";
	}, 1000);
*/

const AtualizacaoEmSegundos=120;

global.array_mac=[];


const server = http.createServer(
    function(req, res){ // é possivel substituir req por '_'
        //console.log("Chegou uma solicitacao");
        res.writeHead(200);
        let ing = "";
        //res.write("<html>");
        let ip_sta = fs.readFileSync("ip_sta.txt", "utf-8", async function(err, data) {
            return await data;
       }).split('\n');

       let mac_ap = fs.readFileSync("mac_ap.txt", "utf-8", async function(err,data){
            return await data;
       }).split('\n');


       let mac_sta = fs.readFileSync("mac_sta.txt", "utf-8", async function(err,data){
            return await data;
        }).split('\n');

        
    
        res.write("[");
        for(let i=0; i<ip_sta.length;i++){
            res.write("\n{\n");
            res.write("\"ip_sta\":"+"\""+ip_sta[i]+"\"");
            res.write(",\n");
            res.write("\"mac_sta\":"+"\""+mac_sta[i]+"\"");
            res.write(",\n");
            res.write("\"mac_ap\":"+"\""+mac_ap[i]+"\"");
            res.write(",\n");
            res.write("\"date\":"+"\""+
            new Date(Date.now()).getFullYear()+
            "-"+
            new Date(Date.now()).getMonth()+
            "-"+
            new Date(Date.now()).getDay()+
            " "+
            new Date(Date.now()).getHours()+
            ":"+
            new Date(Date.now()).getMinutes()+
            ":"+
            new Date(Date.now()).getSeconds()+
            "\"");
            if(i<ip_sta.length-1)
                res.write("\n},");
            else
            res.write("\n}");
        }

        //console.log(r);
        let ubiquity_clients = fs.readFileSync("ubiquity_clients.json","utf-8", async function(err,data){return await data;});
        ubiquity_clients = JSON.parse(ubiquity_clients);
        for(let i=0; i<ubiquity_clients.length;i++){
            if(i==0){
                res.write(',');
                continue;
            }
            res.write("\n{\n");
            
            res.write("\"ip_sta\":");
            res.write("\""+ubiquity_clients[i].ip+"\"");
            res.write(",\n");
            
            res.write("\"mac_sta\":");
            res.write("\""+ubiquity_clients[i].mac+"\"");
            res.write(",\n");

            res.write("\"mac_ap\":");
            res.write("\""+ubiquity_clients[i].ap_mac+"\"");
            res.write(",\n");
            
            res.write("\"date\":"+"\""+
            new Date(Date.now()).getFullYear()+
            "-"+
            new Date(Date.now()).getMonth()+
            "-"+
            new Date(Date.now()).getDay()+
            " "+
            new Date(Date.now()).getHours()+
            ":"+
            new Date(Date.now()).getMinutes()+
            ":"+
            new Date(Date.now()).getSeconds()+
            "\"");

            if(i<ubiquity_clients.length-1)
            {
                res.write('\n},');
            }else{
                res.write("\n}");
            }
        }
        
        res.end("]");
    }
);//const server = http.createServer();

async function load_ip_sta() {
    fs.readFileSync("ip_sta.txt", "utf-8", async function(err, data) {
       return await data;
  });
}


const criarFilhos = () =>{
    const processos = cpus().length;
    console.log("iniciado processo pai "+process.pid+" para criar processos filhos");
    for (let i = 0; i < processos; i++) {
        cluster.fork();
    }
    let session = new snmp.Session({host:'10.10.60.253'});
    let unifi = new Unifi.Controller({host:'10.10.0.14', port:'8443', sslverify: false});
    setInterval(
	()=>{
        //
        // Atualiza  arquivos
        //
		atualiza_arquivo_mac_sta_zyxel(session);
        atualiza_arquivo_mac_ap_zyxel(session);
        atualiza_arquivo_ip_sta_zyxel(session);
        unifi = new Unifi.Controller({host:'10.10.0.14', port:'8443', sslverify: false});
        json_ubiquity(unifi);
        console.log("Busca realizada.\n");
	}
	,
	AtualizacaoEmSegundos*1000
	);
}

async function json_ubiquity(unifi){
    try {
        // LOGIN
        const loginData = await unifi.login('admin', '#p4lm4s');
        console.log('login: ' + loginData);

        // GET SITE STATS
 //       const sites = await unifi.getSitesStats();
  //      console.log('getSitesStats: ' + sites[0].name + ':' + sites.length);
  //      console.log(JSON.stringify(sites));

        // GET SITE SYSINFO
 //       const sysinfo = await unifi.getSiteSysinfo();
 //       console.log('getSiteSysinfo: ' + sysinfo.length);
        //console.log(JSON.stringify(sysinfo));

        // GET CLIENT DEVICES
        const clientData = await unifi.getClientDevices();
//        console.log('getClientDevices: ' + clientData.length);
      //console.log(JSON.stringify(clientData));
      atualiza_arquivo_ubiquity(clientData);
      console.log("arquivo ubiquity gravado");

        // GET ALL USERS EVER CONNECTED
 //       const usersData = await unifi.getAllUsers();
//          console.log('getAllUsers: ' + usersData.length);
//          console.log(JSON.stringify(usersData));

        // LOGOUT
        const logoutData = await unifi.logout();
        //console.log('logout: ' + JSON.stringify(logoutData));
    } catch (error) {
        console.log('ERROR: ' + error);
    }
}

function atualiza_arquivo_ubiquity(clientData){
    let file = fs.createWriteStream('ubiquity_clients.json');
    
    let formatted_json = JSON.stringify(clientData);
    
    file.write(formatted_json);
}

function atualiza_arquivo_ip_sta_zyxel(session){
    session.getSubtree({oid:[1,3,6,1,4,1,890,1,15,3,5,14,1,5]}, function (error, varbinds){
        if(error){
            console.log('Fail ip_sta_zyxel :(');
        }else{
            for(let i=0; i<varbinds.length; i++){
                if(i==0)
                    global.array_mac=[];
                global.array_mac.push(varbinds[i].value);
            }
            let file = fs.createWriteStream('ip_sta.txt');
            for(let i=0; i<global.array_mac.length;i++){
                file.write(global.array_mac[i]);
            
                if(i!=global.array_mac.length-1)
                    file.write("\n");
            
            }
            file.end();
            console.log("Arquivo ip_sta sobrescrito");
        }
    });
    return global.array_mac
}

function atualiza_arquivo_mac_ap_zyxel(session){
    session.getSubtree({oid:[1,3,6,1,4,1,890,1,15,3,5,14,1,6]}, function (error, varbinds){
        if(error){
            console.log('Fail mac ap zyxel :(');
        }else{
            for(let i=0; i<varbinds.length; i++){
                if(i==0)
                    global.array_mac=[];
                global.array_mac.push(varbinds[i].value);
            }
            let file = fs.createWriteStream('mac_ap.txt');
            for(let i=0; i<global.array_mac.length;i++){
                file.write(global.array_mac[i]);
                
                if(i!=global.array_mac.length-1)
                    file.write("\n");
            }
            file.end();
            console.log("Arquivo mac_ap sobrescrito");
        }
    })
}

function atualiza_arquivo_mac_sta_zyxel(session){
    session.getSubtree({ oid: [1,3,6,1,4,1,890,1,15,3,5,14,1,2] }, function (error, varbinds) {
        if (error) {
            console.log('Fail  mac sta zyxel :(');
        } else {
                
                for(let i=0; i<varbinds.length; i++){
                    if(i==0)
                        global.array_mac=[];
                    global.array_mac.push(varbinds[i].value);
                }
                let file = fs.createWriteStream('mac_sta.txt');
                for(let i=0; i<global.array_mac.length;i++){
                    file.write(global.array_mac[i]);
                    
                    if(i!=global.array_mac.length-1)
                        file.write("\n");
                }
                file.end();
                console.log("Arquivo mac_sta sobrescrito");
        }
    });
}

const iniciarFilho = ()=>{
    console.log("Servidor iniciado com pid "+process.pid+".");
    const PORT = 8000;
    server.listen(
        PORT, 
        function(){
            console.log(`Servidor iniciado em http://localhost:${PORT}`);
        }
    );
}

if(cluster.isPrimary)
    criarFilhos();
else
    iniciarFilho();
