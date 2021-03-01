import React from 'react';
import ReactDOM from "react-dom";

const UserContext = React.createContext({
    host: "http://localhost:9001",
    game: "",
    setGame: () => {},
    name: "",
    setName: () => {},
    resetValues: () => {},
    bid: "",
    setBid: () => {},
    buyBid: "",
    setBuyBid: () => {},
    buyCountry: "",
    setBuyCountry: () => {},
    returnStock: "",
    setReturnStock: () => {},
    buyStock: "",
    setBuyStock: () => {},
    vote: "",
    setVote: () => {},
    wheelSpot: "",
    setWheelSpot: () => {},
    factoryLoc: "",
    setFactoryLoc: () => {},
    fleetProduce: "",
    setFleetProduce: () => {},
    armyProduce: "",
    setArmyProduce: () => {},
    fleetMan: "",
    setFleetMan: () => {},
    armyMan: "",
    setArmyMan: () => {},
    import: "",
    setImport: () => {},
});

export default UserContext;