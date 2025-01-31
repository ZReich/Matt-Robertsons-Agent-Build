import Link from "next/link";

import {
  FaReact,
  FaGithub,
  FaTwitter,
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaYoutube,
  FaTwitch,
  FaAmazon,
  FaApple,
  FaGoogle,
  FaMicrosoft,
  FaAndroid,
  FaAngular,
  FaAws,
  FaBitcoin,
  FaChrome,
  FaDocker,
  FaDropbox,
  FaEthereum,
  FaFirefox,
  FaJava,
  FaPython,
  FaUber,
} from "react-icons/fa";

import type { IconType } from "../../types";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const icons: IconType[] = [
  { icon: FaReact, name: "React" },
  { icon: FaGithub, name: "GitHub" },
  { icon: FaTwitter, name: "Twitter" },
  { icon: FaFacebook, name: "Facebook" },
  { icon: FaInstagram, name: "Instagram" },
  { icon: FaLinkedin, name: "LinkedIn" },
  { icon: FaYoutube, name: "YouTube" },
  { icon: FaTwitch, name: "Twitch" },
  { icon: FaAmazon, name: "Amazon" },
  { icon: FaApple, name: "Apple" },
  { icon: FaGoogle, name: "Google" },
  { icon: FaMicrosoft, name: "Microsoft" },
  { icon: FaAndroid, name: "Android" },
  { icon: FaAngular, name: "Angular" },
  { icon: FaAws, name: "AWS" },
  { icon: FaBitcoin, name: "Bitcoin" },
  { icon: FaChrome, name: "Chrome" },
  { icon: FaDocker, name: "Docker" },
  { icon: FaDropbox, name: "Dropbox" },
  { icon: FaEthereum, name: "Ethereum" },
  { icon: FaFirefox, name: "Firefox" },
  { icon: FaJava, name: "Java" },
  { icon: FaPython, name: "Python" },
  { icon: FaUber, name: "Uber" },
];

export function ReactIcons() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>React Icons</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {icons.map(({ icon: Icon, name }) => (
            <div key={name} className="flex flex-col items-center">
              <Icon className="w-8 h-8 mb-2" />
              <span className="text-sm text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="justify-center">
        <Button asChild>
          <Link
            href="https://react-icons.github.io/react-icons/"
            target="_blank"
            rel="noopener noreferrer"
          >
            View all React Icons
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
