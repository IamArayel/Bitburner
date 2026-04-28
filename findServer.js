/** @param {NS} ns */
export async function main(ns) {
    ns.tprint(connectCommandToServer(findPathToServer(ns, "home", ns.args[0])));
}
 
/**
 * returns an array containing all servers between currentServer and the target
 */
export function findPathToServer(ns, currentServer, target, previousServer) {
 
    //if we were asked to find the server we're currently on, we're done. 
    //Return an array with just that.
    if (currentServer == target) {
        return [currentServer];
    }
 
    //otherwise, see if the target is connected to one of our neighbors
    let neighbors = ns.scan(currentServer);
    for (var i = 0; i < neighbors.length; i++) {
        var neighbor = neighbors[i];
 
        //ignore any server we just visited, we don't want to go backwards
        //I don't think scan returns currentServer, but in case it does, treat it the same as the previous server
        if (neighbor == previousServer || neighbor == currentServer) {
            continue;
        }
 
        //recursively call findserver using neighbor as our new currentServer (and currentServer is our new previousServer)
        //Basically, check if our target is down this path
        let findResult = findPathToServer(ns, neighbor, target, currentServer);
 
        //if we got an actual answer back, create an array starting at currentServer followed by the findResult(s)
        //This will collapse the recursion into an array of all connections from home to target
        if (findResult != null) {
            var newResult = [currentServer].concat(findResult)
            return newResult;
        }
 
    }
 
    //If we get here, we didn't find our target connected to any of these neighbors. 
    //The target must've been down a different branch
    return null;
}
 
/**
 * Given an array of servers, make a copy-pasteable command that will chain terminal "connect" commands from first to last.
 * Useful for making things like commands that can take you from home to CSEC (and other faction-related servers).
 */
export function connectCommandToServer(pathArray) {
    var connectCommand = "";
    for (var i = 0; i < pathArray.length; i++) {
        if (pathArray[i] != "home") {
            connectCommand += "connect "
        }
        connectCommand += pathArray[i] + ";"
    }
    return connectCommand;
}