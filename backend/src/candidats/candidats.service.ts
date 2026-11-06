import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Candidat, CandidatDocument } from './schemas/candidat.schema';
import { CreateCandidatDto } from './dto/create-candidat.dto';
import { UpdateCandidatDto } from './dto/update-candidat.dto';

@Injectable()
export class CandidatsService {
  constructor(
    @InjectModel(Candidat.name) private candidatModel: Model<CandidatDocument>,
  ) {}

  create(createCandidatDto: CreateCandidatDto, centreId: string) {
    const candidat = new this.candidatModel({ ...createCandidatDto, centreId });
    return candidat.save();
  }

  findAll(centreId: string, nom?: string) {
    if (nom) {
      return this.candidatModel
        .find({
          centreId,
          $or: [
            { nom: { $regex: nom, $options: 'i' } },
            { prenom: { $regex: nom, $options: 'i' } },
          ],
        })
        .exec();
    }
    return this.candidatModel.find({ centreId }).exec();
  }

  findOne(id: string, centreId: string) {
    return this.candidatModel.findOne({ _id: id, centreId }).exec();
  }

  async update(
    id: string,
    updateCandidatDto: UpdateCandidatDto,
    modifiePar: string,
    centreId: string,
  ) {
    const { raison, ...champs } = updateCandidatDto;

    const champsModifies = Object.keys(champs)
      .filter((cle) => champs[cle as keyof typeof champs] !== undefined)
      .join(', ');

    const candidat = await this.candidatModel
      .findOneAndUpdate(
        { _id: id, centreId },
        {
          $set: champs,
          $push: {
            historique: {
              raison,
              modifiePar,
              champsModifies: champsModifies || 'aucun champ',
              date: new Date(),
            },
          },
        },
        { new: true },
      )
      .exec();

    if (!candidat) {
      throw new NotFoundException('Candidat introuvable');
    }
    return candidat;
  }
  async remove(id: string, centreId: string) {
    const candidat = await this.candidatModel.findOneAndDelete({ _id: id, centreId }).exec();
    if (!candidat) {
      throw new NotFoundException('Candidat introuvable');
    }
    return candidat;
  }
}