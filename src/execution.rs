use std::collections::BTreeSet;

use crate::transaction::Transaction;

/// Partition transactions into deterministic batches whose transactions touch disjoint accounts.
/// This is a scheduling primitive only; it does not execute transactions in parallel.
pub fn conflict_free_batches(transactions: &[Transaction]) -> Vec<Vec<usize>> {
    let mut batches: Vec<Vec<usize>> = Vec::new();
    let mut touched_per_batch: Vec<BTreeSet<&str>> = Vec::new();

    for (index, transaction) in transactions.iter().enumerate() {
        let sender = transaction.sender.as_str();
        let recipient = transaction.recipient.as_str();
        let batch_index = touched_per_batch.iter().position(|touched| {
            !touched.contains(sender) && !touched.contains(recipient)
        });

        match batch_index {
            Some(batch) => {
                batches[batch].push(index);
                touched_per_batch[batch].insert(sender);
                touched_per_batch[batch].insert(recipient);
            }
            None => {
                let mut touched = BTreeSet::new();
                touched.insert(sender);
                touched.insert(recipient);
                touched_per_batch.push(touched);
                batches.push(vec![index]);
            }
        }
    }
    batches
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tx(sender: &str, recipient: &str) -> Transaction {
        Transaction {
            sender: sender.to_owned(),
            recipient: recipient.to_owned(),
            amount: 1,
            fee: 1,
            nonce: 0,
            public_key: sender.to_owned(),
            signature: String::new(),
        }
    }

    #[test]
    fn groups_only_disjoint_account_accesses() {
        let transactions = vec![
            tx("a", "b"),
            tx("c", "d"),
            tx("a", "e"),
            tx("f", "g"),
        ];
        assert_eq!(conflict_free_batches(&transactions), vec![vec![0, 1], vec![2, 3]]);
    }

    #[test]
    fn preserves_transaction_order_within_batches() {
        let transactions = vec![tx("a", "b"), tx("b", "c"), tx("d", "e")];
        assert_eq!(conflict_free_batches(&transactions), vec![vec![0, 2], vec![1]]);
    }

    #[test]
    fn empty_input_has_no_batches() {
        assert!(conflict_free_batches(&[]).is_empty());
    }
}
