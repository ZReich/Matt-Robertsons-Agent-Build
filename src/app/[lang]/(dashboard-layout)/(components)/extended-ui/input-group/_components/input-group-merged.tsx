"use client";

import * as React from "react";
import { Search, Mail, Lock, DollarSign, Link2, AtSign } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InputGroup, InputGroupText } from "@/components/ui/input-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function InputGroupMerged() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Input Merged</CardTitle>
      </CardHeader>
      <CardContent className="grid justify-center gap-2">
        <InputGroup>
          <InputGroupText merged aria-label="@">
            <AtSign className="h-4 w-4" />
          </InputGroupText>
          <Input type="text" placeholder="Username" />
        </InputGroup>
        <InputGroup>
          <Input type="email" placeholder="Email" />
          <InputGroupText merged>@example.com</InputGroupText>
        </InputGroup>
        <InputGroup>
          <InputGroupText merged aria-hidden>
            <Search className="h-4 w-4" />
          </InputGroupText>
          <Input type="search" placeholder="Search..." />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </InputGroup>
        <InputGroup>
          <InputGroupText merged aria-hidden>
            <Mail className="h-4 w-4" />
          </InputGroupText>
          <Input type="email" placeholder="Email" />
          <InputGroupText merged aria-hidden>
            <Lock className="h-4 w-4" />
          </InputGroupText>
          <Input type="password" placeholder="Password" />
        </InputGroup>
        <InputGroup>
          <InputGroupText merged className="items-center" aria-hidden>
            <Mail className="h-4 w-4" />
          </InputGroupText>
          <Textarea placeholder="Type your message here." />
        </InputGroup>
        <InputGroup>
          <InputGroupText merged aria-hidden>
            <DollarSign className="h-4 w-4" />
          </InputGroupText>
          <Input type="number" placeholder="Amount" min={0} step={1} />
          <InputGroupText merged>.00</InputGroupText>
        </InputGroup>
        <InputGroup>
          <InputGroupText merged aria-hidden>
            <Link2 className="h-4 w-4" />
          </InputGroupText>
          <Input type="url" placeholder="your-domain.com" />
          <Button type="button" variant="secondary">
            Verify
          </Button>
        </InputGroup>
      </CardContent>
    </Card>
  );
}
