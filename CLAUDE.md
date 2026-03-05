# Context 
I am doing a project where i am building a mail automation agent for a company. Its a german mittelstand company that produces paper products. 

## Goal 
The agent is supposed to partly automate the task of the secretary. Receive all of their 1000 daily emails and classify them into three buckets. They use outlook, however only through a local exchange, not ms graph supported, so we might have to scrape the mails with the login user. In these buckets, we will have to put the most important 5-10% of the mails that are supposed to be presented to the CEO for decision making. Following three buckets: 

Tradion - their paper packaging business
Staubfilter - their vacum machine beutel business branch
Rest - all other mails 

## Stack 
JS, node, Remix 
Its gonna be an internally hosted service, over company vpn. 

## Pipeline
We pull the mails, and then make an LLM call to classify the mails through the system prompt together with a lot of edge case rules and modifications. 

## UI
Apple style, low cognitive load, professional.


