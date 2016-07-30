import * as React from "react"
import { Link } from "react-router"

export interface LobbyProps {}

export default function Lobby(props: LobbyProps) {
    return (
        <div>
            <Link to={ { pathname: "/game", query: {server: true } } }>Spela som server</Link>
            <Link to={ { pathname: "/game"} }>Spela som klient</Link>
        </div>
    )
}
